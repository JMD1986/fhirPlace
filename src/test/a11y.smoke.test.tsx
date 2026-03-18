// Mock fetch globally to prevent network errors in PatientView/AuditLogPage
if (typeof global.fetch === "undefined") {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    }),
  );
}
import React from "react";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import "@testing-library/jest-dom";
import SearchContainer from "../Components/MainSearch/SearchContainer";
import PatientView from "../Components/Patient/PatientView";
import AuditLogPage from "../Components/Audit/AuditLogPage";
import SessionTimeoutWarning from "../Components/Auth/SessionTimeoutWarning";
import { TestProviders } from "./TestProviders";
import { vi } from "vitest";

// Ensure localStorage is available (jsdom may not provide it in all setups)
if (
  typeof localStorage === "undefined" ||
  typeof localStorage.getItem !== "function"
) {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) =>
      Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key in store) delete store[key];
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length;
    },
  });
}

import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import "@testing-library/jest-dom";
import SearchContainer from "../Components/MainSearch/SearchContainer";
import PatientView from "../Components/Patient/PatientView";
import AuditLogPage from "../Components/Audit/AuditLogPage";
import SessionTimeoutWarning from "../Components/Auth/SessionTimeoutWarning";
import { TestProviders } from "./TestProviders";
// Mock audit API to prevent network calls and provide valid default data
vi.mock("../api/auditApi", () => ({
  queryAuditEvents: vi.fn().mockResolvedValue({ events: [], total: 0 }),
  getAuditStats: vi
    .fn()
    .mockResolvedValue({ totalEvents: 0, actionCounts: {} }),
  logAuditEvent: vi.fn().mockResolvedValue({ status: "ok", id: 1 }),
}));

// Mock FHIR.oauth2.ready for AuthProvider (Vitest)
vi.mock("fhirclient", () => ({
  __esModule: true,
  default: {
    oauth2: {
      ready: () =>
        Promise.resolve({
          state: {},
          getPatientId: () => "test-patient-id",
          refresh: () => Promise.resolve(),
        }),
      authorize: vi.fn(),
    },
  },
}));

describe("a11y smoke tests", () => {
  it("SearchContainer is accessible", async () => {
    const { container } = render(
      <TestProviders>
        <SearchContainer />
      </TestProviders>,
    );
    const results = await axe(container);
    if (results.violations.length > 0) {
      console.error(
        "SearchContainer a11y violations:",
        JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            description: v.description,
            nodes: v.nodes.map((n) => n.html),
          })),
          null,
          2,
        ),
      );
    }
    expect(results.violations.length).toBe(0);
  });

  it("PatientView is accessible", async () => {
    const { container } = render(
      <TestProviders>
        <PatientView patientId="test-id" />
      </TestProviders>,
    );
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });

  it("AuditLogPage is accessible", async () => {
    const { container } = render(
      <TestProviders>
        <AuditLogPage />
      </TestProviders>,
    );
    const results = await axe(container);
    if (results.violations.length > 0) {
      console.error(
        "AuditLogPage a11y violations:",
        JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            description: v.description,
            impact: v.impact,
            nodes: v.nodes.map((n) => n.html.substring(0, 200)),
          })),
          null,
          2,
        ),
      );
    }
    expect(results.violations.length).toBe(0);
  });

  it("SessionTimeoutWarning is accessible", async () => {
    const { container } = render(
      <SessionTimeoutWarning
        open={true}
        secondsLeft={120}
        onStayLoggedIn={() => {}}
        onLogout={() => {}}
      />,
    );
    const results = await axe(container);
    expect(results.violations.length).toBe(0);
  });
});
