/**
 * hookTypes.ts
 *
 * Centralised type definitions for all custom hooks.
 * Import from here instead of directly from the hook files.
 */

// ─── useFHIRResource ──────────────────────────────────────────────────────────

export interface FHIRResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// ─── useNLMClinicalTables ─────────────────────────────────────────────────────

export interface NLMConditionInfo {
  consumerName: string;     // e.g. "High blood pressure (hypertension (HTN))"
  medlinePlusUrl: string;   // e.g. "http://www.nlm.nih.gov/medlineplus/..."
  medlinePlusLabel: string; // e.g. "High Blood Pressure"
  icd10Code: string;        // e.g. "I10"
  loading: boolean;
  error: string | null;
}

export interface NLMLoincInfo {
  loincNum: string;      // e.g. "8867-4"
  component: string;     // e.g. "Heart rate"
  shortName: string;     // e.g. "Heart rate"
  exampleUnits: string;  // e.g. "/min"
  description: string;   // long description (may be empty)
  method: string;        // e.g. "Automated count"
  orderObs: string;      // "Order" | "Observation" | "Both" | "Subset"
  loincClass: string;    // e.g. "PANEL.HEMATOLOGY&COAGULATION"
  loading: boolean;
  error: string | null;
}

// ─── useNPPES ─────────────────────────────────────────────────────────────────

export interface NPPESAddress {
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postal_code: string;
  telephone_number?: string;
  fax_number?: string;
  address_purpose?: string; // "LOCATION" | "MAILING"
}

export interface NPPESTaxonomy {
  code: string;
  desc: string;
  primary: boolean;
  state?: string;
  license?: string;
}

export interface NPPESResult {
  number: string; // NPI
  enumeration_type: "NPI-1" | "NPI-2";
  basic: {
    // Organization (NPI-2)
    organization_name?: string;
    // Individual (NPI-1)
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    credential?: string;
    gender?: string;
    sole_proprietor?: string;
    status?: string;
  };
  addresses: NPPESAddress[];
  taxonomies: NPPESTaxonomy[];
  other_names?: Array<{ type: string; organization_name?: string }>;
}

export interface NPPESData {
  results: NPPESResult[];
  loading: boolean;
  error: string | null;
  searchedBy: "npi" | "name" | null;
}

// ─── useOpenFDA ───────────────────────────────────────────────────────────────

export interface FDAReaction {
  term: string;
  count: number;
}

export interface FDARecall {
  recall_number: string;
  status: string;       // "Ongoing" | "Terminated" | "Completed" | "Pending"
  classification: string; // "Class I" | "Class II" | "Class III"
  reason_for_recall: string;
  product_description: string;
  recall_initiation_date?: string;
}

export interface OpenFDAData {
  topReactions: FDAReaction[];
  recalls: FDARecall[];
  totalReports: number;
  loading: boolean;
  error: string | null;
}

// ─── useRxNorm ────────────────────────────────────────────────────────────────

export interface RxNormDrugClass {
  classId: string;
  className: string;
  classType: string; // "EPC" | "MOA" | "ATC1-4" | "CHEM" | etc.
  rela: string;      // "has_epc" | "has_moa" | "has_chemical_structure" | etc.
}

export interface RxNormData {
  ingredientName: string;
  ingredientRxcui: string;
  brandNames: string[];
  brandedProducts: string[];
  drugClasses: RxNormDrugClass[];
  loading: boolean;
  error: string | null;
}

// ─── useSavedSearches ─────────────────────────────────────────────────────────

export interface PatientSearchParams {
  name: string;
  familyName: string;
  givenName: string;
  gender: string;
  birthDate: string;
  phone: string;
  address: string;
}

export interface EncounterSearchParams {
  patient: string;
  status: string;
  classCode: string;
  type: string;
  dateFrom: string;
  dateTo: string;
  reason: string;
}

export type SearchKind = "patient" | "encounter";

export interface SavedSearch<
  T extends PatientSearchParams | EncounterSearchParams,
> {
  id: string;
  name: string;
  kind: SearchKind;
  params: T;
  createdAt: string;
}
