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

interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}
interface EncounterResource {
  resourceType: "Encounter";
  id: string;
  status?: string;
  class?: FhirCoding;
  type?: { text?: string; coding?: FhirCoding[] }[];
  subject?: { reference?: string; display?: string };
  participant?: {
    type?: { text?: string; coding?: FhirCoding[] }[];
    period?: { start?: string; end?: string };
    individual?: { display?: string };
  }[];
  period?: { start?: string; end?: string };
  location?: { location?: { display?: string }; status?: string }[];
  serviceProvider?: { display?: string };
  reason?: { text?: string; coding?: FhirCoding[] }[];
  diagnosis?: {
    condition?: { display?: string };
    role?: { text?: string };
    rank?: number;
  }[];
  hospitalization?: {
    admitSource?: { text?: string };
    dischargeDisposition?: { text?: string };
  };
  identifier?: { system?: string; value?: string }[];
  _patientId?: string;
}
interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

interface AnyResource {
  resourceType: string;
  id: string;
  // DocumentReference
  type?: { text?: string; coding?: FhirCoding[] };
  date?: string;
  // Condition
  code?: { text?: string; coding?: FhirCoding[] };
  onsetDateTime?: string;
  recordedDate?: string;
  // DiagnosticReport
  effectiveDateTime?: string;
  status?: string;
  // Claim / EOB
  created?: string;
  billablePeriod?: { start?: string; end?: string };
  use?: string;
}

interface FhirBundle {
  resourceType: "Bundle";
  total: number;
  entry?: { resource: AnyResource }[];
}

// ── Config: one entry per resource type ───────────────────────────────────────
interface ResourceTypeConfig {
  resourceType: string;
  label: string;
  route: string;
  viewPath: string;
  icon: React.ReactNode;
  getLabel: (r: AnyResource) => string;
  getDate: (r: AnyResource) => string | null | undefined;
}
