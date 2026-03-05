/**
 * FHIR-5  AC3 — Persist last search params to sessionStorage
 *
 * When a user navigates away from PatientSearch and then comes back,
 * the search form must be restored to its last submitted state.
 *
 * Implementation contract tested here:
 *  - After a successful search, the submitted params are written to
 *    sessionStorage under the key "fhirPlace_patientSearch_lastParams".
 *  - On mount, if that key exists, the form fields are pre-populated with
 *    the stored values.
 *  - EncounterSearch follows the same contract under
 *    "fhirPlace_encounterSearch_lastParams".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

export const PATIENT_SEARCH_KEY = "fhirPlace_patientSearch_lastParams";
export const ENCOUNTER_SEARCH_KEY = "fhirPlace_encounterSearch_lastParams";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("../hooks/useSavedSearches", () => ({
  useSavedSearches: () => ({
    searches: [],
    save: vi.fn(),
    remove: vi.fn(),
    rename: vi.fn(),
    MAX_SAVED: 5,
  }),
}));

const mockPatientSearch = vi.fn();
vi.mock("../api/fhirApi", () => ({
  patientApi: { search: (...args: unknown[]) => mockPatientSearch(...args) },
  encounterApi: {
    search: vi.fn().mockResolvedValue({ entry: [], total: 0 }),
    getTypes: vi.fn().mockResolvedValue([]),
    getClasses: vi.fn().mockResolvedValue([]),
  },
}));

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear();
  mockPatientSearch.mockResolvedValue({ entry: [], total: 0 });
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);
});

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderPatientSearch = async () => {
  const { default: PatientSearch } =
    await import("../Components/Patient/PatientSearch");
  return render(
    <MemoryRouter>
      <PatientSearch />
    </MemoryRouter>,
  );
};

const renderEncounterSearch = async () => {
  const { default: EncounterSearch } =
    await import("../Components/Encounter/EncounterSearch");
  return render(
    <MemoryRouter>
      <EncounterSearch />
    </MemoryRouter>,
  );
};

// ─────────────────────────────────────────────────────────────────────────────

describe("PatientSearch — sessionStorage persistence (FHIR-5 AC3)", () => {
  it("writes submitted search params to sessionStorage after a search", async () => {
    await renderPatientSearch();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/patient name/i), "Alice");
    await user.type(screen.getByLabelText(/family name/i), "Smith");
    await user.click(screen.getByRole("button", { name: /search patients/i }));

    await waitFor(() => {
      const stored = sessionStorage.getItem(PATIENT_SEARCH_KEY);
      expect(stored).not.toBeNull();
      const params = JSON.parse(stored!);
      expect(params.name).toBe("Alice");
      expect(params.familyName).toBe("Smith");
    });
  }, 15_000);

  it("restores form fields from sessionStorage on mount", async () => {
    // Pre-populate sessionStorage as if a previous search was performed
    sessionStorage.setItem(
      PATIENT_SEARCH_KEY,
      JSON.stringify({
        name: "Bob",
        familyName: "Jones",
        givenName: "",
        gender: "male",
        birthDate: "",
        phone: "",
        address: "",
      }),
    );

    await renderPatientSearch();

    expect(screen.getByLabelText(/patient name/i)).toHaveValue("Bob");
    expect(screen.getByLabelText(/family name/i)).toHaveValue("Jones");
    expect(screen.getByLabelText(/gender/i)).toHaveValue("male");
  });

  it("overwrites sessionStorage with the latest submitted params", async () => {
    // Seed with old params
    sessionStorage.setItem(
      PATIENT_SEARCH_KEY,
      JSON.stringify({
        name: "Old",
        familyName: "",
        givenName: "",
        gender: "",
        birthDate: "",
        phone: "",
        address: "",
      }),
    );

    await renderPatientSearch();

    const user = userEvent.setup();
    // Clear the restored "Old" value and type something new
    await user.clear(screen.getByLabelText(/patient name/i));
    await user.type(screen.getByLabelText(/patient name/i), "New");
    await user.click(screen.getByRole("button", { name: /search patients/i }));

    await waitFor(() => {
      const stored = JSON.parse(sessionStorage.getItem(PATIENT_SEARCH_KEY)!);
      expect(stored.name).toBe("New");
    });
  }, 15_000);

  it("clears sessionStorage when the form is cleared", async () => {
    sessionStorage.setItem(
      PATIENT_SEARCH_KEY,
      JSON.stringify({
        name: "Alice",
        familyName: "",
        givenName: "",
        gender: "",
        birthDate: "",
        phone: "",
        address: "",
      }),
    );

    await renderPatientSearch();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /clear/i }));

    await waitFor(() => {
      const stored = sessionStorage.getItem(PATIENT_SEARCH_KEY);
      // Either the key is removed or the stored value has all-empty fields
      if (stored !== null) {
        const params = JSON.parse(stored);
        expect(Object.values(params).every((v) => v === "")).toBe(true);
      } else {
        expect(stored).toBeNull();
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("EncounterSearch — sessionStorage persistence (FHIR-5 AC3)", () => {
  it("writes submitted search params to sessionStorage after a search", async () => {
    await renderEncounterSearch();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/patient/i), "pat-001");
    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );

    await waitFor(() => {
      const stored = sessionStorage.getItem(ENCOUNTER_SEARCH_KEY);
      expect(stored).not.toBeNull();
      const params = JSON.parse(stored!);
      expect(params.patient).toBe("pat-001");
    });
  });

  it("restores form fields from sessionStorage on mount", async () => {
    sessionStorage.setItem(
      ENCOUNTER_SEARCH_KEY,
      JSON.stringify({
        patient: "pat-restored",
        status: "",
        classCode: "",
        type: "",
        dateFrom: "",
        dateTo: "",
        reason: "",
      }),
    );

    await renderEncounterSearch();

    expect(screen.getByLabelText(/patient/i)).toHaveValue("pat-restored");
  });
});
