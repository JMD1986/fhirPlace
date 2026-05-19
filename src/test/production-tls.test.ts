/**
 * Communications Security — production TLS configuration (FHIR-5 compliance).
 */
import { describe, it, expect } from "vitest";
import { assertProductionTlsConfig } from "../lib/productionSecurity";

describe("production TLS config (Communications Security)", () => {
  it("no-ops when not in production", () => {
    expect(() =>
      assertProductionTlsConfig(
        { PROD: false, VITE_API_BASE: "http://insecure.example.com" },
        { protocol: "http:", hostname: "app.example.com" },
      ),
    ).not.toThrow();
  });

  it("requires VITE_API_BASE in production", () => {
    expect(() =>
      assertProductionTlsConfig({ PROD: true }, undefined),
    ).toThrow(/VITE_API_BASE must be set/);
  });

  it("rejects non-HTTPS VITE_API_BASE in production", () => {
    expect(() =>
      assertProductionTlsConfig(
        { PROD: true, VITE_API_BASE: "http://api.example.com" },
        undefined,
      ),
    ).toThrow(/VITE_API_BASE must use HTTPS/);
  });

  it("accepts HTTPS VITE_API_BASE in production", () => {
    expect(() =>
      assertProductionTlsConfig(
        {
          PROD: true,
          VITE_API_BASE: "https://api.example.com",
          VITE_SMART_ISS: "https://ehr.example.com/fhir",
        },
        { protocol: "https:", hostname: "app.example.com" },
      ),
    ).not.toThrow();
  });

  it("rejects non-HTTPS VITE_SMART_ISS when set in production", () => {
    expect(() =>
      assertProductionTlsConfig(
        {
          PROD: true,
          VITE_API_BASE: "https://api.example.com",
          VITE_SMART_ISS: "http://ehr.example.com/fhir",
        },
        undefined,
      ),
    ).toThrow(/VITE_SMART_ISS must use HTTPS/);
  });

  it("rejects non-HTTPS VITE_VITALS_ENDPOINT when set in production", () => {
    expect(() =>
      assertProductionTlsConfig(
        {
          PROD: true,
          VITE_API_BASE: "https://api.example.com",
          VITE_VITALS_ENDPOINT: "http://analytics.example.com/vitals",
        },
        undefined,
      ),
    ).toThrow(/VITE_VITALS_ENDPOINT must use HTTPS/);
  });

  it("rejects SPA served over HTTP in production (non-localhost)", () => {
    expect(() =>
      assertProductionTlsConfig(
        { PROD: true, VITE_API_BASE: "https://api.example.com" },
        { protocol: "http:", hostname: "app.example.com" },
      ),
    ).toThrow(/must be served over HTTPS/);
  });

  it("allows localhost SPA over HTTP for local production builds", () => {
    expect(() =>
      assertProductionTlsConfig(
        { PROD: true, VITE_API_BASE: "https://api.example.com" },
        { protocol: "http:", hostname: "localhost" },
      ),
    ).not.toThrow();
  });
});
