/**
 * SMART on FHIR configuration — Epic sandbox presets, scopes, and ISS helpers.
 * See docs/sandbox-setup.md (Option E) and .env.epic.example.
 */

/** Epic FHIR host (sandbox and production). */
export const EPIC_FHIR_HOST = "fhir.epic.com";

/** Default Epic non-production R4 FHIR base (ISS). Confirm in your app registration. */
export const EPIC_SANDBOX_ISS_DEFAULT =
  "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4";

/** Public SMART Health IT R4 sandbox — no registration. */
export const SMART_HEALTH_IT_ISS = "https://r4.smarthealthit.org";

/** Granular patient read scopes Epic expects (wildcard `patient/*.read` is often rejected). */
export const EPIC_PATIENT_READ_SCOPES = [
  "patient/Patient.read",
  "patient/Encounter.read",
  "patient/Condition.read",
  "patient/DiagnosticReport.read",
  "patient/DocumentReference.read",
  "patient/Immunization.read",
  "patient/MedicationRequest.read",
  "patient/Observation.read",
  "patient/Procedure.read",
  "patient/Claim.read",
  "patient/ExplanationOfBenefit.read",
] as const;

const EPIC_SCOPE_BASE = ["openid", "fhirUser", "offline_access"] as const;

/** Standalone launch scopes for Epic (no EHR `launch` token). */
export const EPIC_STANDALONE_SCOPES = [
  ...EPIC_SCOPE_BASE,
  ...EPIC_PATIENT_READ_SCOPES,
].join(" ");

/** EHR-embedded launch scopes for Epic (`/launch?iss=&launch=`). */
export const EPIC_EHR_LAUNCH_SCOPES = [
  ...EPIC_SCOPE_BASE,
  "launch",
  "launch/patient",
  ...EPIC_PATIENT_READ_SCOPES,
].join(" ");

const GENERIC_STANDALONE_SCOPES =
  "openid fhirUser patient/*.read offline_access";

const GENERIC_EHR_LAUNCH_SCOPES =
  "openid fhirUser launch/patient patient/*.read offline_access";

export function isEpicIss(iss: string): boolean {
  try {
    return new URL(iss).hostname === EPIC_FHIR_HOST;
  } catch {
    return iss.includes(EPIC_FHIR_HOST);
  }
}

/** Default ISS for launch UI — Epic preset when VITE_EPIC_SANDBOX_ISS is set, else VITE_SMART_ISS. */
export function getDefaultSmartIss(): string {
  const epic = import.meta.env.VITE_EPIC_SANDBOX_ISS as string | undefined;
  if (epic?.trim()) return epic.trim();
  return (
    (import.meta.env.VITE_SMART_ISS as string | undefined)?.trim() ??
    SMART_HEALTH_IT_ISS
  );
}

export function getSmartClientId(): string {
  return import.meta.env.VITE_SMART_CLIENT_ID ?? "fhirplace-dev";
}

export function getSmartRedirectUri(): string {
  const configured = import.meta.env.VITE_SMART_REDIRECT_URI as
    | string
    | undefined;
  if (configured?.trim()) return configured.trim();
  return `${window.location.origin}/callback`;
}

/**
 * OAuth scope string for authorize().
 * Epic uses explicit per-resource scopes; other sandboxes use patient/*.read.
 */
export function getSmartScopes(options: {
  iss: string;
  embedded: boolean;
}): string {
  if (isEpicIss(options.iss)) {
    return options.embedded ? EPIC_EHR_LAUNCH_SCOPES : EPIC_STANDALONE_SCOPES;
  }
  return options.embedded ? GENERIC_EHR_LAUNCH_SCOPES : GENERIC_STANDALONE_SCOPES;
}

export type SmartIssPreset = "smart-health-it" | "epic-sandbox";

export function issForPreset(preset: SmartIssPreset): string {
  return preset === "epic-sandbox" ? EPIC_SANDBOX_ISS_DEFAULT : SMART_HEALTH_IT_ISS;
}
