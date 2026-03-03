import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FDAReaction {
  term: string;
  count: number;
}

export interface FDARecall {
  recall_number: string;
  status: string; // "Ongoing" | "Terminated" | "Completed" | "Pending"
  classification: string; // "Class I" | "Class II" | "Class III"
  reason_for_recall: string;
  product_description: string;
  recall_initiation_date?: string;
}

export interface OpenFDAData {
  topReactions: FDAReaction[]; // top 10 adverse reactions by report count
  recalls: FDARecall[]; // active/recent recalls
  totalReports: number; // total adverse event reports found
  loading: boolean;
  error: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a clean drug search term — strip dosage info so OpenFDA matches broadly.
 *  e.g. "Amoxicillin 250 MG Oral Capsule" → "amoxicillin" */
function extractGenericName(fullName: string): string {
  // Take first word (generic name), lower-case it
  return fullName.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9-]/g, "");
}

const BASE = "https://api.fda.gov";

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches OpenFDA data for a given drug.
 * Pass either an rxcui code or a full drug display name (or both).
 *
 * @param rxcui   RxNorm code from medicationCodeableConcept.coding[0].code
 * @param drugName Full display name, e.g. "Amoxicillin 250 MG Oral Capsule"
 */
export function useOpenFDA(
  rxcui?: string,
  drugName?: string,
): OpenFDAData {
  const [topReactions, setTopReactions] = useState<FDAReaction[]>([]);
  const [recalls, setRecalls] = useState<FDARecall[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rxcui && !drugName) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setTopReactions([]);
      setRecalls([]);
      setTotalReports(0);

      try {
        const generic = drugName ? extractGenericName(drugName) : null;

        // Build search strings — prefer rxcui for precision, fall back to name
        const eventSearch = rxcui
          ? `patient.drug.openfda.rxcui:"${rxcui}"`
          : `patient.drug.medicinalproduct:"${generic}"`;

        const recallSearch = rxcui
          ? `openfda.rxcui:"${rxcui}"`
          : `openfda.generic_name:"${generic}"`;

        // Fetch both in parallel
        const [reactionsRes, recallsRes] = await Promise.allSettled([
          fetch(
            `${BASE}/drug/event.json?search=${encodeURIComponent(eventSearch)}&count=patient.reaction.reactionmeddrapt.exact&limit=10`,
          ),
          fetch(
            `${BASE}/drug/enforcement.json?search=${encodeURIComponent(recallSearch)}&limit=5`,
          ),
        ]);

        if (cancelled) return;

        // ── Reactions ──
        if (
          reactionsRes.status === "fulfilled" &&
          reactionsRes.value.ok
        ) {
          const data = await reactionsRes.value.json();
          if (data.results) {
            setTopReactions(data.results as FDAReaction[]);
            setTotalReports(data.meta?.results?.total ?? 0);
          }
        }

        // ── Recalls ── (404 simply means none found — that's fine)
        if (
          recallsRes.status === "fulfilled" &&
          recallsRes.value.status !== 404
        ) {
          const data = await recallsRes.value.json();
          if (data.results) {
            setRecalls(data.results as FDARecall[]);
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [rxcui, drugName]);

  return { topReactions, recalls, totalReports, loading, error };
}
