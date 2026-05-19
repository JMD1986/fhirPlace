/**
 * FHIR-aligned access control helpers (RBAC).
 *
 * fhirPlace maps SMART launch roles to FHIR CRUD permissions:
 * - provider: read/search across patients (within OAuth scopes from the EHR)
 * - patient: read only the Patient resource bound to the launch context
 *
 * ABAC-style attributes (confidentiality tags, consent, purpose of use) are
 * enforced by the EHR authorization server and returned data; this module covers
 * application-layer RBAC for the bundled synthetic API and UI routing.
 */

export type AccessRole = "patient" | "provider";

export interface AccessSubject {
  role: AccessRole;
  /** Patient resource id from SMART launch context (patient role only). */
  linkedPatientId?: string;
}

/** Normalize Patient/id, urn:uuid:, or bare id to a comparable token. */
export function normalizePatientId(id: string): string {
  return id
    .replace(/^Patient\//i, "")
    .replace(/^urn:uuid:/i, "")
    .trim();
}

export function patientIdsMatch(a: string, b: string): boolean {
  return normalizePatientId(a) === normalizePatientId(b);
}

/**
 * Whether the subject may read the given patient's record.
 * Unauthenticated sessions (synthetic demo) are allowed — production EHR
 * traffic uses SMART tokens and server-side checks when role headers are set.
 */
export function canReadPatient(
  subject: AccessSubject | null,
  patientId: string,
): boolean {
  if (!subject) return true;
  if (subject.role === "provider") return true;
  if (subject.role === "patient") {
    return (
      !!subject.linkedPatientId &&
      patientIdsMatch(subject.linkedPatientId, patientId)
    );
  }
  return false;
}

/** Audit log and operational views are limited to provider-role sessions. */
export function canAccessAuditLog(subject: AccessSubject | null): boolean {
  if (!subject) return true;
  return subject.role === "provider";
}

/** Patient-role users must not run cross-patient search UIs. */
export function canSearchPatients(subject: AccessSubject | null): boolean {
  if (!subject) return true;
  return subject.role === "provider";
}
