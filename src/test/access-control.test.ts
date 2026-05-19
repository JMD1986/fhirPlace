import { describe, it, expect } from "vitest";
import {
  canAccessAuditLog,
  canReadPatient,
  canSearchPatients,
  normalizePatientId,
  patientIdsMatch,
} from "../lib/accessControl";

describe("accessControl (FHIR RBAC)", () => {
  it("normalizes Patient references and urn:uuid", () => {
    expect(normalizePatientId("Patient/abc")).toBe("abc");
    expect(normalizePatientId("urn:uuid:abc")).toBe("abc");
    expect(patientIdsMatch("Patient/abc", "urn:uuid:abc")).toBe(true);
  });

  it("allows unauthenticated demo access", () => {
    expect(canReadPatient(null, "any-id")).toBe(true);
    expect(canSearchPatients(null)).toBe(true);
  });

  it("restricts patient role to linked patient only", () => {
    const subject = { role: "patient" as const, linkedPatientId: "p1" };
    expect(canReadPatient(subject, "p1")).toBe(true);
    expect(canReadPatient(subject, "Patient/p1")).toBe(true);
    expect(canReadPatient(subject, "p2")).toBe(false);
    expect(canSearchPatients(subject)).toBe(false);
    expect(canAccessAuditLog(subject)).toBe(false);
  });

  it("allows provider role broad read", () => {
    const subject = { role: "provider" as const };
    expect(canReadPatient(subject, "any")).toBe(true);
    expect(canSearchPatients(subject)).toBe(true);
    expect(canAccessAuditLog(subject)).toBe(true);
  });
});
