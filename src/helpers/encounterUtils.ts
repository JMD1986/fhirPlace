// encounterUtils.ts
// Shared helpers for Encounter components
import type { FhirEncounter } from "../Components/Encounter/encounterTypes";

export const stripNums = (s: string) => s.replace(/\d+/g, "").trim();

export const getType = (enc: FhirEncounter) =>
  enc.type?.[0]?.text ?? enc.type?.[0]?.coding?.[0]?.display ?? "—";

export const getPatientDisplay = (enc: FhirEncounter) => {
  const raw = enc.subject?.display ?? "";
  return raw
    .split(" ")
    .map((w) => stripNums(w))
    .filter(Boolean)
    .join(" ");
};

export const getPractitioner = (enc: FhirEncounter) =>
  enc.participant?.[0]?.individual?.display ?? "—";

export const getLocation = (enc: FhirEncounter) =>
  enc.location?.[0]?.location?.display ?? enc.serviceProvider?.display ?? "—";

export const formatDate = (iso?: string) => (iso ? iso.slice(0, 10) : "—");

export const statusColor = (
  status?: string,
): "success" | "warning" | "error" | "default" => {
  if (status === "finished") return "success";
  if (status === "in-progress") return "warning";
  if (status === "cancelled") return "error";
  return "default";
};
