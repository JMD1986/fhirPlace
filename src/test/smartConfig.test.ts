import { describe, it, expect } from "vitest";
import {
  EPIC_SANDBOX_ISS_DEFAULT,
  EPIC_STANDALONE_SCOPES,
  getSmartScopes,
  isEpicIss,
  issForPreset,
} from "../lib/smartConfig";

describe("isEpicIss", () => {
  it("returns true for Epic sandbox FHIR base", () => {
    expect(isEpicIss(EPIC_SANDBOX_ISS_DEFAULT)).toBe(true);
  });

  it("returns false for SMART Health IT", () => {
    expect(isEpicIss("https://r4.smarthealthit.org")).toBe(false);
  });
});

describe("getSmartScopes", () => {
  it("uses granular patient scopes for Epic standalone", () => {
    const scopes = getSmartScopes({
      iss: EPIC_SANDBOX_ISS_DEFAULT,
      embedded: false,
    });
    expect(scopes).toContain("patient/Patient.read");
    expect(scopes).not.toContain("patient/*.read");
  });

  it("uses patient/*.read for generic standalone", () => {
    const scopes = getSmartScopes({
      iss: "https://r4.smarthealthit.org",
      embedded: false,
    });
    expect(scopes).toContain("patient/*.read");
  });

  it("includes launch/patient for Epic embedded launch", () => {
    const scopes = getSmartScopes({
      iss: EPIC_SANDBOX_ISS_DEFAULT,
      embedded: true,
    });
    expect(scopes).toContain("launch/patient");
    expect(scopes).toContain("launch");
  });
});

describe("issForPreset", () => {
  it("maps epic-sandbox to Epic R4 ISS", () => {
    expect(issForPreset("epic-sandbox")).toBe(EPIC_SANDBOX_ISS_DEFAULT);
  });
});

describe("EPIC_STANDALONE_SCOPES", () => {
  it("includes offline_access for token refresh", () => {
    expect(EPIC_STANDALONE_SCOPES).toContain("offline_access");
  });
});
