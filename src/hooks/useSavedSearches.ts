import { useState, useCallback } from "react";
import type {
  PatientSearchParams,
  EncounterSearchParams,
  SearchKind,
  SavedSearch,
} from "./hookTypes";

type AnySearch = SavedSearch<PatientSearchParams> | SavedSearch<EncounterSearchParams>;

// ── localStorage key (per-user via email slug) ────────────────────────────────
const storageKey = (userEmail?: string) =>
  `fhirPlace_savedSearches${userEmail ? `_${userEmail}` : ""}`;

// ── PHI storage audit (FHIR-9) ───────────────────────────────────────────────
// localStorage stores user-authored SEARCH QUERY TEMPLATES only.
// Specifically, PatientSearchParams fields (name, familyName, givenName,
// gender, birthDate, phone, address) and EncounterSearchParams fields
// (patient ref, status, classCode, type, dateFrom, dateTo, reason) are
// persisted as user-entered search criteria, NOT as retrieved patient records.
//
// Risk classification: LOW — values are partial / user-typed inputs that may
// contain demographic fragments. They are scoped to the authenticated user's
// email slug, never contain OAuth tokens, and are never populated from server
// responses.  No Encounter clinical notes, diagnosis codes, medication data,
// or other clinical PHI from server responses are written here.
//
// Mitigation: keys are cleared on explicit "delete saved search" actions;
// no server-fetched PHI (names, DOBs, clinical data) is ever passed to
// persist().  Reviewed and approved per FHIR-9 security hardening.

const load = (userEmail?: string): AnySearch[] => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userEmail)) ?? "[]");
  } catch {
    return [];
  }
};

const persist = (searches: AnySearch[], userEmail?: string) => {
  localStorage.setItem(storageKey(userEmail), JSON.stringify(searches));
};

const MAX_SAVED = 3;

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages up to MAX_SAVED (3) saved searches per kind ("patient" | "encounter"),
 * stored in localStorage scoped to the current user's email.
 */
export function useSavedSearches(kind: SearchKind, userEmail?: string) {
  const [all, setAll] = useState<AnySearch[]>(() => load(userEmail));

  const searches = all.filter((s) => s.kind === kind) as SavedSearch<
    PatientSearchParams | EncounterSearchParams
  >[];

  const save = useCallback(
    (name: string, params: PatientSearchParams | EncounterSearchParams) => {
      setAll((prev) => {
        const others = prev.filter((s) => s.kind !== kind);
        const same = prev.filter((s) => s.kind === kind);

        // Replace existing by same name (case-insensitive), otherwise prepend
        const existingIdx = same.findIndex(
          (s) => s.name.toLowerCase() === name.toLowerCase(),
        );

        let next: AnySearch[];
        if (existingIdx !== -1) {
          const updated = [...same];
          updated[existingIdx] = {
            ...updated[existingIdx],
            params,
            createdAt: new Date().toISOString(),
          } as AnySearch;
          next = [...others, ...updated];
        } else {
          const newEntry = {
            id: crypto.randomUUID(),
            name: name.trim(),
            kind,
            params,
            createdAt: new Date().toISOString(),
          } as AnySearch;
          // Enforce max: drop the oldest if already at limit
          const trimmed = same.length >= MAX_SAVED ? same.slice(0, MAX_SAVED - 1) : same;
          next = [...others, newEntry, ...trimmed];
        }

        persist(next, userEmail);
        return next;
      });
    },
    [kind, userEmail],
  );

  const remove = useCallback(
    (id: string) => {
      setAll((prev) => {
        const next = prev.filter((s) => s.id !== id);
        persist(next, userEmail);
        return next;
      });
    },
    [userEmail],
  );

  const rename = useCallback(
    (id: string, newName: string) => {
      setAll((prev) => {
        const next = prev.map((s) =>
          s.id === id ? { ...s, name: newName.trim() } : s,
        );
        persist(next, userEmail);
        return next;
      });
    },
    [userEmail],
  );

  return { searches, save, remove, rename, MAX_SAVED };
}
