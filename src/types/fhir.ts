/**
 * Central FHIR type definitions for fhirPlace.
 *
 * All components should import from here rather than declaring local
 * interfaces. This prevents drift when the same resource type is used in
 * multiple places.
 */

// ── Primitives ────────────────────────────────────────────────────────────────

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  text?: string;
  coding?: FhirCoding[];
}

export interface FhirReference {
  reference?: string;
  display?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
}

export interface FhirMoney {
  value?: number;
  currency?: string;
}

export interface FhirExtension {
  url: string;
  valueString?: string;
  valueAddress?: { city?: string; state?: string; country?: string };
  extension?: FhirExtension[];
}

// ── Shared bundle wrapper ─────────────────────────────────────────────────────

export interface FhirBundle<T = AnyResource> {
  resourceType: "Bundle";
  type?: string;
  total?: number;
  entry?: { resource: T; fullUrl?: string; search?: { mode: string } }[];
}

// ── Patient ───────────────────────────────────────────────────────────────────

export interface FhirName {
  use?: string;
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

/** Minimal Patient shape — used in search results */
export interface Patient {
  resourceType: "Patient";
  id: string;
  name?: FhirName[];
  gender?: string;
  birthDate?: string;
  address?: FhirAddress[];
  communication?: FhirCommunication[];
}

/** Full Patient resource with all optional fields */
export interface PatientResource extends Patient {
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  maritalStatus?: { text?: string };
  identifier?: Array<{
    type?: { text?: string };
    value?: string;
    system?: string;
  }>;
  extension?: FhirExtension[];
  [key: string]: unknown;
}

// ── Encounter ─────────────────────────────────────────────────────────────────

export interface EncounterResource {
  resourceType?: "Encounter";
  id: string;
  status?: string;
  class?: { code?: string };
  type?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
  subject?: FhirReference;
  _patientId?: string;
  period?: FhirPeriod;
  participant?: Array<{
    type?: Array<{ text?: string }>;
    period?: FhirPeriod;
    individual?: FhirReference;
  }>;
  serviceProvider?: FhirReference;
  location?: Array<{ location?: FhirReference }>;
  diagnosis?: Array<{
    condition?: FhirReference;
    role?: { text?: string };
    rank?: number;
  }>;
  reason?: Array<{ text?: string; coding?: Array<{ display?: string }> }>;
}

// ── Condition ─────────────────────────────────────────────────────────────────

export interface ConditionResource {
  resourceType: "Condition";
  id: string;
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  onsetDateTime?: string;
  recordedDate?: string;
  _patientId?: string;
  _encounterId?: string;
}

// ── DiagnosticReport ──────────────────────────────────────────────────────────

export interface DiagnosticReportResource {
  resourceType: "DiagnosticReport";
  id: string;
  status?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FhirReference[];
  presentedForm?: { contentType?: string; data?: string; title?: string }[];
  _patientId?: string;
  _encounterId?: string;
}

// ── DocumentReference ─────────────────────────────────────────────────────────

export interface DocRefResource {
  resourceType: "DocumentReference";
  id: string;
  status?: string;
  type?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  date?: string;
  author?: FhirReference[];
  custodian?: FhirReference;
  subject?: FhirReference;
  context?: {
    encounter?: FhirReference[];
    period?: FhirPeriod;
  };
  content?: { attachment?: { contentType?: string; data?: string } }[];
  _patientId?: string;
}

// ── Immunization ──────────────────────────────────────────────────────────────

export interface ImmunizationResource {
  resourceType: "Immunization";
  id: string;
  status?: string;
  vaccineCode?: FhirCodeableConcept;
  patient?: FhirReference;
  encounter?: FhirReference;
  occurrenceDateTime?: string;
  primarySource?: boolean;
  location?: FhirReference;
  _patientId?: string;
}

// ── Procedure ─────────────────────────────────────────────────────────────────

export interface ProcedureResource {
  resourceType: "Procedure";
  id: string;
  status?: string;
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  performedPeriod?: FhirPeriod;
  performedDateTime?: string;
  location?: FhirReference;
  reasonCode?: FhirCodeableConcept[];
  _patientId?: string;
}

// ── Observation ───────────────────────────────────────────────────────────────

export interface ObservationResource {
  resourceType: "Observation";
  id: string;
  status?: string;
  category?: FhirCodeableConcept[];
  code?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  valueQuantity?: FhirQuantity;
  valueString?: string;
  valueCodeableConcept?: FhirCodeableConcept;
  interpretation?: FhirCodeableConcept[];
  component?: {
    code?: FhirCodeableConcept;
    valueQuantity?: FhirQuantity;
    valueString?: string;
  }[];
  _patientId?: string;
}

// ── MedicationRequest ─────────────────────────────────────────────────────────

export interface MedicationRequestResource {
  resourceType: "MedicationRequest";
  id: string;
  status?: string;
  intent?: string;
  medicationCodeableConcept?: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference;
  dosageInstruction?: { text?: string; sequence?: number }[];
  reasonCode?: FhirCodeableConcept[];
  _patientId?: string;
}

// ── Claim ─────────────────────────────────────────────────────────────────────

export interface ClaimItem {
  sequence?: number;
  productOrService?: FhirCodeableConcept;
  net?: FhirMoney;
  quantity?: { value?: number };
  unitPrice?: FhirMoney;
}

export interface ClaimResource {
  resourceType: "Claim";
  id: string;
  status?: string;
  use?: string;
  type?: FhirCodeableConcept;
  patient?: FhirReference;
  billablePeriod?: FhirPeriod;
  created?: string;
  provider?: FhirReference;
  facility?: FhirReference;
  insurance?: { coverage?: FhirReference }[];
  item?: ClaimItem[];
  total?: FhirMoney;
  _patientId?: string;
}

// ── ExplanationOfBenefit ──────────────────────────────────────────────────────

export interface AdjudicationItem {
  category?: FhirCodeableConcept;
  amount?: FhirMoney;
  reason?: FhirCodeableConcept;
}

export interface EoBItem {
  sequence?: number;
  productOrService?: FhirCodeableConcept;
  net?: FhirMoney;
  quantity?: { value?: number };
  adjudication?: AdjudicationItem[];
}

export interface EoBTotal {
  category?: FhirCodeableConcept;
  amount?: FhirMoney;
}

export interface EoBResource {
  resourceType: "ExplanationOfBenefit";
  id: string;
  status?: string;
  outcome?: string;
  use?: string;
  type?: FhirCodeableConcept;
  patient?: FhirReference;
  billablePeriod?: FhirPeriod;
  created?: string;
  insurer?: FhirReference;
  facility?: FhirReference;
  claim?: FhirReference;
  total?: EoBTotal[];
  payment?: { amount?: FhirMoney };
  item?: EoBItem[];
  _patientId?: string;
}

// ── Generic resource union (for list/panel components) ────────────────────────

export interface AnyResource {
  resourceType: string;
  id: string;
  // DocumentReference
  type?: FhirCodeableConcept;
  date?: string;
  // Condition
  code?: FhirCodeableConcept;
  onsetDateTime?: string;
  recordedDate?: string;
  // DiagnosticReport / Observation
  effectiveDateTime?: string;
  status?: string;
  // Claim / EOB
  created?: string;
  billablePeriod?: FhirPeriod;
  use?: string;
  // Immunization
  vaccineCode?: FhirCodeableConcept;
  occurrenceDateTime?: string;
  // Procedure
  performedPeriod?: FhirPeriod;
  performedDateTime?: string;
  // Observation
  category?: FhirCodeableConcept[];
  valueQuantity?: FhirQuantity;
  // MedicationRequest
  medicationCodeableConcept?: FhirCodeableConcept;
  authoredOn?: string;
  intent?: string;
  // Encounter
  period?: FhirPeriod;
  class?: { code?: string };
}

// ── Resource type config (used by panel/list components) ──────────────────────

export interface ResourceTypeConfig {
  resourceType: string;
  label: string;
  route: string;
  viewPath: string;
  icon: React.ReactNode;
  getLabel: (r: AnyResource) => string;
  getDate: (r: AnyResource) => string | null | undefined;
}

export interface ResourceGroup {
  config: ResourceTypeConfig;
  items: AnyResource[];
}
