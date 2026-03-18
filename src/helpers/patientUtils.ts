// patientUtils.ts
// Shared FHIR data extraction and formatting helpers for Patient components

import type {
  Patient,
  PatientResource,
  FhirExtension,
  FhirName,
  FhirAddress,
} from "../types/fhir";

// Remove numbers from a string (for display)
export function stripNums(s: string) {
  return s.replace(/\d+/g, "").trim();
}

// Get display name for a Patient
export function getName(patient: Patient) {
  const n = patient.name?.[0];
  const given = n?.given?.map(stripNums).join(" ") ?? "";
  const family = stripNums(n?.family ?? "");
  return [given, family].filter(Boolean).join(" ") || patient.id;
}

// Get address for a Patient
export function getAddress(patient: Patient) {
  const a = patient.address?.[0];
  if (!a) return "—";
  return [a.line?.join(" "), a.city, a.state, a.postalCode]
    .filter(Boolean)
    .join(", ");
}

// Get language for a Patient
export function getLanguage(patient: Patient) {
  const c = patient.communication?.[0];
  return c?.language?.text ?? c?.language?.coding?.[0]?.display ?? "—";
}

// Extract Patient resource from FHIR Bundle or direct Patient object
export function extractPatientFromBundle(data: Record<string, unknown>): PatientResource | null {
  if (data?.resourceType === "Patient") {
    return data as unknown as PatientResource;
  }
  if (data?.resourceType === "Bundle" && Array.isArray(data.entry)) {
    const patientEntry = (data.entry as Record<string, unknown>[]).find(
      (entry) => (entry?.resource as Record<string, unknown>)?.resourceType === "Patient"
    );
    return (patientEntry?.resource as PatientResource) || null;
  }
  return null;
}

// Extract race from FHIR extensions
export function getRace(extensions: FhirExtension[] | undefined): string {
  const raceExt = extensions?.find(
    (ext) => ext.url === "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
  );
  return (
    raceExt?.extension?.find((ext: FhirExtension) => ext.url === "text")?.valueString ??
    "Not provided"
  );
}

// Extract ethnicity from FHIR extensions
export function getEthnicity(extensions: FhirExtension[] | undefined): string {
  const ethnExt = extensions?.find(
    (ext) => ext.url === "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
  );
  return (
    ethnExt?.extension?.find((ext: FhirExtension) => ext.url === "text")?.valueString ??
    "Not provided"
  );
}

// Extract birth place from FHIR extensions
export function getBirthPlace(extensions: FhirExtension[] | undefined): string {
  const birthPlaceExt = extensions?.find(
    (ext) => ext.url === "http://hl7.org/fhir/StructureDefinition/patient-birthPlace"
  );
  if (!birthPlaceExt?.valueAddress) return "Not provided";
  const addr = birthPlaceExt.valueAddress;
  return `${addr.city ?? ''}, ${addr.state ?? ''} ${addr.country ?? ''}`.trim();
}

// Format FHIR name
export function formatName(nameObj: FhirName | undefined): string {
  if (!nameObj) return "Not provided";
  const prefix = nameObj.prefix?.join(" ") || "";
  const given = nameObj.given?.join(" ") || "";
  const family = nameObj.family || "";
  return `${prefix} ${given} ${family}`.trim();
}

// Get phone number from FHIR telecom
export function getPhone(telecom: { system?: string; value?: string }[] | undefined): string {
  const phone = telecom?.find((t) => t.system === "phone");
  return phone?.value || "Not provided";
}

// Format FHIR address
export function formatAddress(address: FhirAddress[] | undefined): string {
  if (!address || address.length === 0) return "Not provided";
  const addr = address[0];
  const stateZip = [addr.state, addr.postalCode].filter(Boolean).join(" ");
  const lines = [
    addr.line?.join(", ") || "",
    addr.city,
    stateZip,
    addr.country,
  ].filter(Boolean);
  return lines.length ? lines.join(", ") : "Not provided";
}
