/**
 * Centralized API client for fhirPlace.
 *
 * All components should import fetch helpers from here rather than
 * calling fetch() directly with hardcoded URLs. This gives us:
 *  - A single place to change the base URL (via VITE_API_BASE in .env)
 *  - Uniform error handling
 *  - Easy place to add auth headers or request logging later
 */

import type {
  AnyResource,
  ConditionResource,
  ClaimResource,
  DiagnosticReportResource,
  DocRefResource,
  EncounterResource,
  EoBResource,
  FhirBundle,
  ImmunizationResource,
  MedicationRequestResource,
  ObservationResource,
  Patient,
  PatientResource,
  ProcedureResource,
} from "../types/fhir";

// ── Base URL ──────────────────────────────────────────────────────────────────
// Set VITE_API_BASE in your .env file. Defaults to localhost for development.

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5001";

// ── Core HTTP helper ──────────────────────────────────────────────────────────

/**
 * Wraps fetch with base URL prepending and standard error handling.
 * Throws an Error with the HTTP status message on non-2xx responses.
 */
const HTTP_STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = res.statusText || HTTP_STATUS_TEXT[res.status] || "Error";
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Patient prefetch cache ──────────────────────────────────────────────────
// Populated by SearchResults on row hover. PatientView consumes it via
// patientApi.getById, which checks here before making a network request.
// This eliminates the navigation delay when the user hovers before clicking View.
const _patientCache = new Map<string, PatientResource>();

// ── Patient endpoints (/api/patients & /fhir/Patient) ────────────────────────

export const patientApi = {
  /** GET /fhir/Patient?<params> */
  search(params: URLSearchParams): Promise<FhirBundle<Patient>> {
    return apiFetch(`/fhir/Patient?${params.toString()}`);
  },

  /** GET /fhir/Patient/:id — serves from prefetch cache when available */
  getById(id: string): Promise<PatientResource> {
    const cached = _patientCache.get(id);
    if (cached) return Promise.resolve(cached);
    return apiFetch<PatientResource>(`/fhir/Patient/${id}`).then((p) => {
      _patientCache.set(id, p);
      return p;
    });
  },

  /** GET /api/patients?name=<q>&_count=<n>  (legacy summary list) */
  searchSummary(
    name: string,
    count = 10,
  ): Promise<{ id: string; name: string }[]> {
    return apiFetch(
      `/api/patients?name=${encodeURIComponent(name)}&_count=${count}`,
    );
  },
};

/**
 * Fire-and-forget prefetch of a single patient into the in-memory cache.
 * Call this on row hover in search results so the data is ready before
 * the user clicks "View".
 */
export function prefetchPatient(id: string): void {
  if (_patientCache.has(id)) return; // already cached
  patientApi.getById(id).catch(() => { /* silently ignore prefetch failures */ });
}

// ── Encounter endpoints ───────────────────────────────────────────────────────

export const encounterApi = {
  /** GET /fhir/Encounter?<params> */
  search(params: URLSearchParams): Promise<FhirBundle<EncounterResource>> {
    return apiFetch(`/fhir/Encounter?${params.toString()}`);
  },

  /** GET /fhir/Encounter/:id */
  getById(id: string): Promise<EncounterResource> {
    return apiFetch(`/fhir/Encounter/${id}`);
  },

  /** GET /fhir/Encounter/_types  (dropdown options) */
  getTypes(): Promise<string[]> {
    return apiFetch("/fhir/Encounter/_types");
  },

  /** GET /fhir/Encounter/_classes  (dropdown options) */
  getClasses(): Promise<string[]> {
    return apiFetch("/fhir/Encounter/_classes");
  },
};

// ── FHIR resource endpoints (generic) ────────────────────────────────────────

/**
 * Fetches a FHIR search bundle for any resource type.
 * e.g. fhirSearch("Condition", new URLSearchParams({ patient: "abc" }))
 */
export function fhirSearch<T = AnyResource>(
  resourceType: string,
  params: URLSearchParams,
): Promise<FhirBundle<T>> {
  return apiFetch(`/fhir/${resourceType}?${params.toString()}`);
}

/**
 * Fetches a single FHIR resource by type and ID.
 * e.g. fhirGet("Condition", "abc-123")
 */
export function fhirGet<T = AnyResource>(
  resourceType: string,
  id: string,
): Promise<T> {
  return apiFetch(`/fhir/${resourceType}/${id}`);
}

// ── Typed single-resource getters ─────────────────────────────────────────────

export const conditionApi = {
  getById: (id: string) => fhirGet<ConditionResource>("Condition", id),
  search: (params: URLSearchParams) =>
    fhirSearch<ConditionResource>("Condition", params),
};

export const diagReportApi = {
  getById: (id: string) => fhirGet<DiagnosticReportResource>("DiagnosticReport", id),
  search: (params: URLSearchParams) =>
    fhirSearch<DiagnosticReportResource>("DiagnosticReport", params),
};

export const documentReferenceApi = {
  getById: (id: string) => fhirGet<DocRefResource>("DocumentReference", id),
  search: (params: URLSearchParams) =>
    fhirSearch<DocRefResource>("DocumentReference", params),
};

export const immunizationApi = {
  getById: (id: string) => fhirGet<ImmunizationResource>("Immunization", id),
  search: (params: URLSearchParams) =>
    fhirSearch<ImmunizationResource>("Immunization", params),
};

export const procedureApi = {
  getById: (id: string) => fhirGet<ProcedureResource>("Procedure", id),
  search: (params: URLSearchParams) =>
    fhirSearch<ProcedureResource>("Procedure", params),
};

export const observationApi = {
  getById: (id: string) => fhirGet<ObservationResource>("Observation", id),
  search: (params: URLSearchParams) =>
    fhirSearch<ObservationResource>("Observation", params),
};

export const medicationRequestApi = {
  getById: (id: string) =>
    fhirGet<MedicationRequestResource>("MedicationRequest", id),
  search: (params: URLSearchParams) =>
    fhirSearch<MedicationRequestResource>("MedicationRequest", params),
};

export const claimApi = {
  getById: (id: string) => fhirGet<ClaimResource>("Claim", id),
  search: (params: URLSearchParams) =>
    fhirSearch<ClaimResource>("Claim", params),
};

export const eobApi = {
  getById: (id: string) => fhirGet<EoBResource>("ExplanationOfBenefit", id),
  search: (params: URLSearchParams) =>
    fhirSearch<EoBResource>("ExplanationOfBenefit", params),
};
