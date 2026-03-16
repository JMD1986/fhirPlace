// ── SearchResults-specific types/interfaces ────────────────────────────────
export interface SearchResultsProps {
  patients: Patient[];
  total: number | null;
  page: number;
  pageSize: number;
  onPageChange: (e: unknown, newPage: number) => void;
  /** called when the user wants to view details for a patient */
  onView?: (id: string) => void;
}
// ── PatientView-specific types/interfaces moved from PatientView.tsx ────────

export interface PatientViewProps {
  /** identifier used to fetch the patient from the API */
  patientId?: string;
}

export type FhirNameEntry = NonNullable<PatientResource["name"]>[number];

export type FhirTelecomEntry = NonNullable<PatientResource["telecom"]>[number];

export type FhirAddressEntry = NonNullable<PatientResource["address"]>[number];

export type FhirIdentifierEntry = NonNullable<PatientResource["identifier"]>[number];

export interface ResourceListViewProps {
  group: any; // Use ResourceGroup if available in types
  patientId: string;
  onBack: () => void;
}
// ── Shared types for Patient components ───────────────────────────────────────

export interface FhirExtension {
  url: string;
  valueString?: string;
  valueAddress?: { city?: string; state?: string; country?: string };
  extension?: FhirExtension[];
}

export interface FhirName {
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
}

export interface FhirAddress {
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface FhirCommunication {
  language?: { text?: string; coding?: { display?: string }[] };
}

export interface Patient {
  resourceType: "Patient";
  id: string;
  name?: FhirName[];
  gender?: string;
  birthDate?: string;
  address?: FhirAddress[];
  communication?: FhirCommunication[];
}

export interface PatientResource {
  id: string;
  resourceType: string;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    text?: string;
  }>;
  gender?: string;
  birthDate?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  maritalStatus?: { text?: string };
  identifier?: Array<{
    type?: { text?: string };
    value?: string;
    system?: string;
  }>;
  extension?: FhirExtension[];
  communication?: Array<{
    language?: { text?: string };
  }>;
  [key: string]: unknown;
}

export interface BillingDashboardProps {
  patientId: string;
}

export interface MonthlyBucket {
  month: string;
  submitted: number;
  paid: number;
  claims: number;
}

export interface PayerBreakdown {
  name: string;
  value: number;
}