/**
 * FHIR-5  AC3 - Persist last search params across in-app navigation
 *
 * Search form values are held in a module-level in-memory store
 * (useSessionState). This means they:
 *   - Survive React component unmount/remount (in-app navigation)
 *   - Reset on page refresh (module re-evaluated)
 *   - Reset when the user clicks Clear / Reset
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

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

beforeEach(() => {
  mockPatientSearch.mockResolvedValue({ entry: [], total: 0 });
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);
  vi.resetModules();
});

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

describe("PatientSearch - in-memory persistence (FHIR-5 AC3)", () => {
  it("form fields are empty on initial mount", async () => {
    await renderPatientSearch();
    expect(screen.getByLabelText(/patient name/i)).toHaveValue("");
    expect(screen.getByLabelText(/family name/i)).toHaveValue("");
  });

  it("persists form values after unmount + remount (in-app navigation)", async () => {
    const { default: PatientSearch } =
      await import("../Components/Patient/PatientSearch");
    const wrap = (<MemoryRouter><PatientSearch /></MemoryRouter>);
    const { unmount } = render(wrap);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/patient name/i), "Alice");
    await user.type(screen.getByLabelText(/family name/i), "Smith");
    await user.click(screen.getByRole("button", { name: /search patients/i }));
    await waitFor(() => expect(mockPatientSearch).toHaveBeenCalled());
    unmount();
    render(wrap);
    expect(screen.getByLabelText(/patient name/i)).toHaveValue("Alice");
    expect(screen.getByLabelText(/family name/i)).toHaveValue("Smith");
  }, 15_000);

  it("clears form values when the Clear button is clicked", async () => {
    const { default: PatientSearch } =
      await import("../Components/Patient/PatientSearch");
    const wrap = (<MemoryRouter><PatientSearch /></MemoryRouter>);
    const { unmount } = render(wrap);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/patient name/i), "Alice");
    await user.click(screen.getByRole("button", { name: /search patients/i }));
    await waitFor(() => expect(mockPatientSearch).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /clear/i }));
    unmount();
    render(wrap);
    expect(screen.getByLabelText(/patient name/i)).toHaveValue("");
    expect(screen.getByLabelText(/family name/i)).toHaveValue("");
  }, 15_000);

  it("does not write search params to sessionStorage", async () => {
    await renderPatientSearch();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/patient name/i), "Alice");
    await user.click(screen.getByRole("button", { name: /search patients/i }));
    await waitFor(() => expect(mockPatientSearch).toHaveBeenCalled());
    const hasSensitiveKey = Object.keys(sessionStorage).some(
      (k) => k.includes("patientSearch") || k.includes("lastParams"),
    );
    expect(hasSensitiveKey).toBe(false);
  }, 15_000);
});

describe("EncounterSearch - in-memory persistence (FHIR-5 AC3)", () => {
  it("form fields are empty on initial mount", async () => {
    await renderEncounterSearch();
    expect(screen.getByLabelText(/patient/i)).toHaveValue("");
  });

  it("does not write search params to sessionStorage", async () => {
    await renderEncounterSearch();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/patient/i), "pat-001");
    await user.click(screen.getByRole("button", { name: /search/i }));
    const hasSensitiveKey = Object.keys(sessionStorage).some(
      (k) => k.includes("encounterSearch") || k.includes("lastParams"),
    );
    expect(hasSensitiveKey).toBe(false);
  }, 15_000);
});
