using System.ComponentModel.DataAnnotations;

namespace FhirPlace.Server;

// ── Patient ───────────────────────────────────────────────────────────────────
// Stores the flat summary fields (used by GET /api/patients) plus:
//   BundleJson    – full Synthea transaction Bundle  (GET /api/patients/:id)
//   ResourceJson  – lean FHIR Patient resource        (GET /fhir/Patient/:id)
public class PatientRecord
{
  [Key] public string Id { get; set; } = "";
  public string Name { get; set; } = "";
  public string Family { get; set; } = "";
  public string Given { get; set; } = "";
  public string Gender { get; set; } = "";
  public string BirthDate { get; set; } = "";
  public string MaritalStatus { get; set; } = "";
  public string Phone { get; set; } = "";
  public string Address { get; set; } = "";
  public string Race { get; set; } = "";
  public string Ethnicity { get; set; } = "";
  public string BirthPlace { get; set; } = "";
  public string Language { get; set; } = "";
  public string Ssn { get; set; } = "";
  public string Mrn { get; set; } = "";
  public string Filename { get; set; } = "";
  public string BundleJson { get; set; } = "";   // full Synthea Bundle
  public string ResourceJson { get; set; } = "";   // Patient resource only
}

// ── Encounter ─────────────────────────────────────────────────────────────────
// Dedicated table so Status / ClassCode / PeriodStart / TypeText can be indexed
// for fast filtered searches without touching ResourceJson.
public class EncounterRecord
{
  [Key] public string Id { get; set; } = "";
  public string PatientId { get; set; } = "";
  public string? Status { get; set; }
  public string? ClassCode { get; set; }
  public string? PeriodStart { get; set; }   // ISO date string, first 10 chars
  public string? TypeText { get; set; }   // type[0].text or coding[0].display
  public string? ReasonText { get; set; }   // concatenated reason texts + codes
  public string ResourceJson { get; set; } = "";
}

// ── Generic FHIR resource ─────────────────────────────────────────────────────
// Used by: DocumentReference, Condition, DiagnosticReport, Immunization,
//          Procedure, Observation, MedicationRequest, Claim, ExplanationOfBenefit
//
// EncounterId – primary (single) encounter link; NULL when linked via junction table
//               or when no encounter reference exists.
// Code        – populated for Observation: code.coding[*].code (pipe-joined)
//               so ?code= filter can use a SQL LIKE query instead of JSON scanning.
public class FhirResourceRecord
{
  [Key] public string Id { get; set; } = "";
  public string ResourceType { get; set; } = "";
  public string PatientId { get; set; } = "";
  public string? EncounterId { get; set; }
  public string? Code { get; set; }  // Observation only
  public string ResourceJson { get; set; } = "";
}

// ── Junction tables ───────────────────────────────────────────────────────────
// DocumentReference can link to *multiple* encounters via context.encounter[].
public class DocRefEncounterLink
{
  public string DocRefId { get; set; } = "";
  public string EncounterId { get; set; } = "";
}

// Claim links to encounters via item[].encounter[].
public class ClaimEncounterLink
{
  public string ClaimId { get; set; } = "";
  public string EncounterId { get; set; } = "";
}

// ExplanationOfBenefit inherits the Claim's encounter links.
public class EobEncounterLink
{
  public string EobId { get; set; } = "";
  public string EncounterId { get; set; } = "";
}
