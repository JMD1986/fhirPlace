// ── Shared types for AdditionalResources components ───────────────────────────

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface AnyResource {
  resourceType: string;
  id: string;
  // DocumentReference
  type?: { text?: string; coding?: FhirCoding[] };
  date?: string;
  // Condition
  code?: { text?: string; coding?: FhirCoding[] };
  onsetDateTime?: string;
  recordedDate?: string;
  // DiagnosticReport / Observation
  effectiveDateTime?: string;
  status?: string;
  // Claim / EOB
  created?: string;
  billablePeriod?: { start?: string; end?: string };
  use?: string;
  // Immunization
  vaccineCode?: { text?: string; coding?: FhirCoding[] };
  occurrenceDateTime?: string;
  // Procedure
  performedPeriod?: { start?: string; end?: string };
  performedDateTime?: string;
  // Observation
  category?: { coding?: FhirCoding[] }[];
  valueQuantity?: { value?: number; unit?: string };
  // MedicationRequest
  medicationCodeableConcept?: { text?: string; coding?: FhirCoding[] };
  authoredOn?: string;
  intent?: string;
  // Encounter
  period?: { start?: string; end?: string };
  class?: { code?: string };
}

export interface FhirBundle {
  resourceType: "Bundle";
  total: number;
  entry?: { resource: AnyResource }[];
}

export interface ResourceTypeConfig {
  resourceType: string;
  label: string;
  route: string;
  viewPath: string;
  icon: React.ReactNode;
  getLabel: (r: AnyResource) => string;
  getDate: (r: AnyResource) => string | null | undefined;
}

export interface DocRefResource {
  resourceType: "DocumentReference";
  id: string;
  status?: string;
  type?: { text?: string; coding?: FhirCoding[] };
  category?: { text?: string; coding?: FhirCoding[] }[];
  date?: string;
  author?: { display?: string }[];
  custodian?: { display?: string };
  subject?: { reference?: string };
  context?: {
    encounter?: { reference?: string }[];
    period?: { start?: string; end?: string };
  };
  content?: { attachment?: { contentType?: string; data?: string } }[];
  _patientId?: string;
}

export interface ClaimItem {
  sequence?: number;
  productOrService?: { text?: string; coding?: FhirCoding[] };
  net?: { value?: number; currency?: string };
  quantity?: { value?: number };
  unitPrice?: { value?: number; currency?: string };
}

export interface ClaimResource {
  resourceType: "Claim";
  id: string;
  status?: string;
  use?: string;
  type?: { text?: string; coding?: FhirCoding[] };
  patient?: { reference?: string; display?: string };
  billablePeriod?: { start?: string; end?: string };
  created?: string;
  provider?: { display?: string };
  facility?: { display?: string };
  insurance?: { coverage?: { display?: string } }[];
  item?: ClaimItem[];
  total?: { value?: number; currency?: string };
  _patientId?: string;
}

export interface AdjudicationItem {
  category?: { coding?: FhirCoding[] };
  amount?: { value?: number; currency?: string };
  reason?: { coding?: FhirCoding[] };
}

export interface EoBItem {
  sequence?: number;
  productOrService?: { text?: string; coding?: FhirCoding[] };
  net?: { value?: number; currency?: string };
  quantity?: { value?: number };
  adjudication?: AdjudicationItem[];
}

export interface EoBTotal {
  category?: { coding?: FhirCoding[] };
  amount?: { value?: number; currency?: string };
}

export interface EoBResource {
  resourceType: "ExplanationOfBenefit";
  id: string;
  status?: string;
  outcome?: string;
  use?: string;
  type?: { text?: string; coding?: FhirCoding[] };
  patient?: { reference?: string; display?: string };
  billablePeriod?: { start?: string; end?: string };
  created?: string;
  insurer?: { display?: string };
  facility?: { display?: string };
  claim?: { reference?: string };
  total?: EoBTotal[];
  payment?: { amount?: { value?: number; currency?: string } };
  item?: EoBItem[];
  _patientId?: string;
}

export interface ConditionResource {
  resourceType: "Condition";
  id: string;
  clinicalStatus?: { coding?: FhirCoding[] };
  verificationStatus?: { coding?: FhirCoding[] };
  category?: { coding?: FhirCoding[] }[];
  code?: { text?: string; coding?: FhirCoding[] };
  subject?: { reference?: string; display?: string };
  encounter?: { reference?: string; display?: string };
  onsetDateTime?: string;
  recordedDate?: string;
  _patientId?: string;
  _encounterId?: string;
}

export interface DiagnosticReportResource {
  resourceType: "DiagnosticReport";
  id: string;
  status?: string;
  category?: { coding?: FhirCoding[] }[];
  code?: { text?: string; coding?: FhirCoding[] };
  subject?: { reference?: string; display?: string };
  encounter?: { reference?: string };
  effectiveDateTime?: string;
  issued?: string;
  performer?: { display?: string; reference?: string }[];
  presentedForm?: { contentType?: string; data?: string; title?: string }[];
  _patientId?: string;
  _encounterId?: string;
}

export interface ImmunizationResource {
  resourceType: "Immunization";
  id: string;
  status?: string;
  vaccineCode?: { text?: string; coding?: FhirCoding[] };
  patient?: { reference?: string; display?: string };
  encounter?: { reference?: string };
  occurrenceDateTime?: string;
  primarySource?: boolean;
  location?: { display?: string };
  _patientId?: string;
}

export interface ProcedureResource {
  resourceType: "Procedure";
  id: string;
  status?: string;
  code?: { text?: string; coding?: FhirCoding[] };
  subject?: { reference?: string; display?: string };
  encounter?: { reference?: string };
  performedPeriod?: { start?: string; end?: string };
  performedDateTime?: string;
  location?: { display?: string };
  reasonCode?: { text?: string; coding?: FhirCoding[] }[];
  _patientId?: string;
}

export interface ObservationResource {
  resourceType: "Observation";
  id: string;
  status?: string;
  category?: { coding?: FhirCoding[] }[];
  code?: { text?: string; coding?: FhirCoding[] };
  subject?: { reference?: string; display?: string };
  encounter?: { reference?: string };
  effectiveDateTime?: string;
  issued?: string;
  valueQuantity?: { value?: number; unit?: string; system?: string; code?: string };
  valueString?: string;
  valueCodeableConcept?: { text?: string; coding?: FhirCoding[] };
  interpretation?: { coding?: FhirCoding[] }[];
  component?: {
    code?: { text?: string; coding?: FhirCoding[] };
    valueQuantity?: { value?: number; unit?: string };
    valueString?: string;
  }[];
  _patientId?: string;
}

export interface MedicationRequestResource {
  resourceType: "MedicationRequest";
  id: string;
  status?: string;
  intent?: string;
  medicationCodeableConcept?: { text?: string; coding?: FhirCoding[] };
  subject?: { reference?: string; display?: string };
  encounter?: { reference?: string };
  authoredOn?: string;
  requester?: { display?: string };
  dosageInstruction?: { text?: string; sequence?: number }[];
  reasonCode?: { text?: string; coding?: FhirCoding[] }[];
  _patientId?: string;
}
