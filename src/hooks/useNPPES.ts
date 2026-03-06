/**
 * useNPPES – NPPES NPI Registry hook
 *
 * Searches the CMS National Plan & Provider Enumeration System (NPPES) API.
 * https://npiregistry.cms.hhs.gov/api-page
 *
 * Synthea synthetic data uses fake NPIs (9999xxxxxx) that aren't in NPPES.
 * Strategy:
 *   1. Try exact NPI number lookup first (fast, precise)
 *   2. If 0 results, fall back to name-based search after stripping the
 *      numeric suffixes Synthea appends (e.g. "Millicent213" → "Millicent")
 */

import { useState, useEffect } from "react";
import type { NPPESAddress, NPPESTaxonomy, NPPESResult, NPPESData } from "./hookTypes";

const BASE = "https://npiregistry.cms.hhs.gov/api/";

// ── helpers ────────────────────────────────────────────────────────────────────

/** Strip numeric suffixes Synthea appends to names, e.g. "Millicent213" → "Millicent" */
const stripNums = (s: string) => s.replace(/\d+/g, "").trim();

/** Clean a practitioner display name into { first, last }
 *  Input: "Dr. Millicent213 Mertz280" → { first: "Millicent", last: "Mertz" }
 */
function parsePractitionerName(display: string): {
  first: string;
  last: string;
} | null {
  // Remove titles / credentials prefix
  const cleaned = display
    .replace(/^(Dr\.?\s*|Mr\.?\s*|Mrs\.?\s*|Ms\.?\s*|RN\s*|MD\s*)/i, "")
    .trim();

  const parts = cleaned
    .split(/\s+/)
    .map(stripNums)
    .filter((p) => p.length > 0);

  if (parts.length < 2) return null;
  const first = parts[0];
  const last = parts[parts.length - 1];
  return { first, last };
}

/** Clean an org display name for search
 *  "FAMILY HEALTH CENTER OF WORCESTER, INC." → "FAMILY HEALTH CENTER OF WORCESTER"
 */
function cleanOrgName(display: string): string {
  return display
    .replace(/,?\s*(INC\.?|LLC\.?|LLP\.?|CORP\.?|CO\.?|LTD\.?)$/i, "")
    .replace(/\d+/g, "") // strip synthea numeric suffixes if any
    .trim();
}

/** Extract 2-letter US state abbreviation from a FHIR address if available */
function extractState(address?: {
  state?: string;
  postalCode?: string;
}): string | null {
  if (address?.state && /^[A-Z]{2}$/i.test(address.state)) {
    return address.state.toUpperCase();
  }
  return null;
}

async function fetchNPPES(params: Record<string, string>): Promise<NPPESResult[]> {
  const url = new URL(BASE);
  Object.entries({ version: "2.1", limit: "5", ...params }).forEach(([k, v]) =>
    url.searchParams.set(k, v),
  );
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`NPPES API error ${res.status}`);
  const json = await res.json();
  return (json.results as NPPESResult[]) ?? [];
}

// ── Practitioner hook ─────────────────────────────────────────────────────────

/**
 * Look up a practitioner by NPI number first; if not found, fall back to
 * first+last name search.
 *
 * @param npi  - NPI number string extracted from FHIR reference (may be fake)
 * @param display - Practitioner display name, e.g. "Dr. Millicent213 Mertz280"
 * @param state - Optional 2-letter state abbreviation to narrow the search
 */
export function useNPPESPractitioner(
  npi?: string | null,
  display?: string | null,
  state?: string | null,
): NPPESData {
  const [data, setData] = useState<NPPESData>({
    results: [],
    loading: false,
    error: null,
    searchedBy: null,
  });

  useEffect(() => {
    // Need at least NPI or a display name with 2+ parts
    if (!npi && !display) return;

    let cancelled = false;

    const run = async () => {
      setData({ results: [], loading: true, error: null, searchedBy: null });
      try {
        // Step 1: try NPI number lookup
        if (npi) {
          const byNpi = await fetchNPPES({ number: npi });
          if (!cancelled && byNpi.length > 0) {
            setData({ results: byNpi, loading: false, error: null, searchedBy: "npi" });
            return;
          }
        }

        // Step 2: fall back to name search
        if (display) {
          const parsed = parsePractitionerName(display);
          if (parsed) {
            const params: Record<string, string> = {
              first_name: parsed.first,
              last_name: parsed.last,
              enumeration_type: "NPI-1",
            };
            if (state) params.state = state;

            const byName = await fetchNPPES(params);
            if (!cancelled) {
              setData({
                results: byName,
                loading: false,
                error: null,
                searchedBy: "name",
              });
            }
          } else if (!cancelled) {
            setData({ results: [], loading: false, error: null, searchedBy: null });
          }
        } else if (!cancelled) {
          setData({ results: [], loading: false, error: null, searchedBy: null });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setData({
            results: [],
            loading: false,
            error: err instanceof Error ? err.message : "NPPES error",
            searchedBy: null,
          });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [npi, display, state]);

  return data;
}

// ── Organization hook ─────────────────────────────────────────────────────────

/**
 * Look up an organization by NPI number first; if not found, fall back to
 * organization name search.
 *
 * @param npi - NPI number (may be fake for Synthea data)
 * @param orgName - Organization display name, e.g. "FAMILY HEALTH CENTER OF WORCESTER, INC."
 * @param state - Optional 2-letter state abbreviation
 */
export function useNPPESOrg(
  npi?: string | null,
  orgName?: string | null,
  state?: string | null,
): NPPESData {
  const [data, setData] = useState<NPPESData>({
    results: [],
    loading: false,
    error: null,
    searchedBy: null,
  });

  useEffect(() => {
    if (!npi && !orgName) return;

    let cancelled = false;

    const run = async () => {
      setData({ results: [], loading: true, error: null, searchedBy: null });
      try {
        // Step 1: try NPI number lookup
        if (npi) {
          const byNpi = await fetchNPPES({ number: npi });
          if (!cancelled && byNpi.length > 0) {
            setData({ results: byNpi, loading: false, error: null, searchedBy: "npi" });
            return;
          }
        }

        // Step 2: fall back to org name search
        if (orgName) {
          const cleaned = cleanOrgName(orgName);
          if (cleaned.length < 3) {
            if (!cancelled)
              setData({ results: [], loading: false, error: null, searchedBy: null });
            return;
          }
          const params: Record<string, string> = {
            organization_name: cleaned,
            enumeration_type: "NPI-2",
          };
          if (state) params.state = state;

          const byName = await fetchNPPES(params);
          if (!cancelled) {
            setData({
              results: byName,
              loading: false,
              error: null,
              searchedBy: "name",
            });
          }
        } else if (!cancelled) {
          setData({ results: [], loading: false, error: null, searchedBy: null });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setData({
            results: [],
            loading: false,
            error: err instanceof Error ? err.message : "NPPES error",
            searchedBy: null,
          });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [npi, orgName, state]);

  return data;
}

// ── Utility: extract NPI from a FHIR reference string ────────────────────────

/**
 * Extracts NPI from FHIR reference strings like:
 *   "Practitioner?identifier=http://hl7.org/fhir/sid/us-npi|9999974295"
 */
export function extractNPIFromReference(reference?: string): string | null {
  if (!reference) return null;
  const match = reference.match(/us-npi\|(\d{10})/);
  return match ? match[1] : null;
}

export { extractState };
