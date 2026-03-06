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

interface BillingDashboardProps {
  patientId: string;
}

interface MonthlyBucket {
  month: string;
  submitted: number;
  paid: number;
  claims: number;
}

interface PayerBreakdown {
  name: string;
  value: number;
}