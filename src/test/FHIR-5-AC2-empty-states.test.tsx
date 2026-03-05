/**
 * FHIR-5  AC2 — Distinct empty states
 *
 * PatientSearch and EncounterSearch must render two visually distinct states:
 *
 *   1. "Search not yet performed"  – rendered on initial mount before the
 *      user has ever submitted the form.  Must contain some "get started"
 *      copy and MUST NOT contain "no results" copy.
 *
 *   2. "No results"  – rendered after the user submits a search that returns
 *      zero matches.  Must contain "no results" copy and MUST NOT contain
 *      the "get started" copy shown in state 1.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Auth — supply a logged-out user so useSavedSearches works safely
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

// Saved searches hook — stubbed so it doesn't touch localStorage
vi.mock("../hooks/useSavedSearches", () => ({
  useSavedSearches: () => ({
    searches: [],
    save: vi.fn(),
    remove: vi.fn(),
    rename: vi.fn(),
    MAX_SAVED: 5,
  }),
}));

// patientApi — we control what search returns per-test
const mockPatientSearch = vi.fn();
vi.mock("../api/fhirApi", () => ({
  patientApi: { search: (...args: unknown[]) => mockPatientSearch(...args) },
  encounterApi: {
    search: vi.fn().mockResolvedValue({ entry: [], total: 0 }),
    getTypes: vi.fn().mockResolvedValue([]),
    getClasses: vi.fn().mockResolvedValue([]),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

// Suppress the fetch for /resources/snomed.json fired by EncounterSearch mount
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: async () => [],
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const emptyBundle = { entry: [], total: 0 };
const onePatientBundle = {
  entry: [
    {
      resource: {
        resourceType: "Patient",
        id: "p1",
        name: [{ text: "Alice Smith", family: "Smith", given: ["Alice"] }],
        gender: "female",
        birthDate: "1990-01-01",
      },
    },
  ],
  total: 1,
};

// Lazy import so vi.mock hoisting runs before the module loads
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

describe("PatientSearch — empty states (FHIR-5 AC2)", () => {
  it('shows a "search to get started" prompt on initial mount', async () => {
    await renderPatientSearch();

    // Should show a prompt inviting the user to search
    expect(
      screen.getByText(/search to get started|enter.*search|start.*search/i),
    ).toBeInTheDocument();
  });

  it('does NOT show "no results" copy on initial mount', async () => {
    await renderPatientSearch();

    expect(screen.queryByText(/no (patients|results) found/i)).toBeNull();
  });

  it('shows "no results" copy after a search returns 0 matches', async () => {
    mockPatientSearch.mockResolvedValue(emptyBundle);
    await renderPatientSearch();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /search patients/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no (patients|results) found/i),
      ).toBeInTheDocument();
    });
  });

  it('does NOT show "search to get started" after a search returns 0 matches', async () => {
    mockPatientSearch.mockResolvedValue(emptyBundle);
    await renderPatientSearch();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /search patients/i }));

    await waitFor(() =>
      expect(screen.queryByText(/no (patients|results) found/i)).not.toBeNull(),
    );

    expect(
      screen.queryByText(/search to get started|enter.*search|start.*search/i),
    ).toBeNull();
  });

  it("shows results (not an empty state) when search returns matches", async () => {
    mockPatientSearch.mockResolvedValue(onePatientBundle);
    await renderPatientSearch();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /search patients/i }));

    await waitFor(() => {
      expect(screen.queryByText(/no (patients|results) found/i)).toBeNull();
      expect(
        screen.queryByText(
          /search to get started|enter.*search|start.*search/i,
        ),
      ).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("EncounterSearch — empty states (FHIR-5 AC2)", () => {
  it('shows a "search to get started" prompt on initial mount', async () => {
    await renderEncounterSearch();

    expect(
      screen.getByText(/search to get started|enter.*search|start.*search/i),
    ).toBeInTheDocument();
  });

  it('does NOT show "no results" copy on initial mount', async () => {
    await renderEncounterSearch();

    expect(screen.queryByText(/no (encounters|results) found/i)).toBeNull();
  });

  it('shows "no results" copy after a search returns 0 matches', async () => {
    const { encounterApi } = await import("../api/fhirApi");
    vi.mocked(encounterApi.search).mockResolvedValue(emptyBundle);

    await renderEncounterSearch();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no (encounters|results) found/i),
      ).toBeInTheDocument();
    });
  });

  it('does NOT show the "get started" prompt after a search completes', async () => {
    const { encounterApi } = await import("../api/fhirApi");
    vi.mocked(encounterApi.search).mockResolvedValue(emptyBundle);

    await renderEncounterSearch();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );

    await waitFor(() =>
      expect(
        screen.queryByText(/no (encounters|results) found/i),
      ).not.toBeNull(),
    );

    expect(
      screen.queryByText(/search to get started|enter.*search|start.*search/i),
    ).toBeNull();
  });
});
