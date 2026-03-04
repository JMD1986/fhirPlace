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
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Patient endpoints (/api/patients & /fhir/Patient) ────────────────────────

export const patientApi = {
  /** GET /fhir/Patient?<params> */
  search(params: URLSearchParams): Promise<FhirBundle<Patient>> {
    return apiFetch(`/fhir/Patient?${params.toString()}`);
  },

  /** GET /fhir/Patient/:id */
  getById(id: string): Promise<PatientResource> {
    return apiFetch(`/fhir/Patient/${id}`);
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
