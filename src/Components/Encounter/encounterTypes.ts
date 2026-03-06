// ── Shared FHIR Encounter types ───────────────────────────────────────────────

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  status?: string;
  class?: FhirCoding;
  type?: { text?: string; coding?: FhirCoding[] }[];
  subject?: { reference?: string; display?: string };
  participant?: { individual?: { display?: string } }[];
  period?: { start?: string; end?: string };
  location?: { location?: { display?: string } }[];
  serviceProvider?: { display?: string };
  reason?: { text?: string; coding?: FhirCoding[] }[];
  _patientId?: string;
}

// Dead-code block removed (FHIR-9 lint fix): duplicate non-exported interfaces
// (EncounterResource, AnyResource, FhirBundle, ResourceTypeConfig) were unused.
// These types are available from ../../types/fhir when needed.
