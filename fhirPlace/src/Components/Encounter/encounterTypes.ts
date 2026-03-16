// ── Shared FHIR Encounter types ─────────────────────────────────────────────

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
  participant?: { individual?: { display?: string }; type?: { text?: string }[]; period?: { start?: string; end?: string } }[];
  period?: { start?: string; end?: string };
  location?: { location?: { display?: string } }[];
  serviceProvider?: { display?: string };
  reason?: { text?: string; coding?: FhirCoding[] }[];
  diagnosis?: { condition?: { display?: string }; role?: { text?: string }; rank?: number }[];
  _patientId?: string;
}

// Props for EncounterSearchResults
export interface EncounterSearchResultsProps {
  encounters: FhirEncounter[];
  total: number | null;
  page: number;
  pageSize: number;
  onPageChange: (e: unknown, newPage: number) => void;
}

// Props for ResourceListView in EncounterView
export interface ResourceListViewProps {
  group: any; // Use ResourceGroup if available
  encounterId: string;
  patientId?: string;
  onBack: () => void;
}

// Props for NPPESPanel in EncounterView
export interface NPPESPanelProps {
  practitionerNpi?: string | null;
  practitionerDisplay?: string | null;
  orgNpi?: string | null;
  orgName?: string | null;
  state?: string | null;
}
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
