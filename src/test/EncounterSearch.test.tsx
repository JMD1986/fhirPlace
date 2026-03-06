import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import EncounterSearch from "../Components/Encounter/EncounterSearch";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEncounterSearch = vi.fn();
const mockGetTypes = vi.fn();
const mockGetClasses = vi.fn();

vi.mock("../api/fhirApi", () => ({
  encounterApi: {
    search: (...args: unknown[]) => mockEncounterSearch(...args),
    getTypes: () => mockGetTypes(),
    getClasses: () => mockGetClasses(),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "test@example.com" } }),
}));

// useSessionState relies on sessionStorage which jsdom provides; no mock needed

vi.mock("../hooks/useSavedSearches", () => ({
  useSavedSearches: () => ({
    searches: [],
    save: vi.fn(),
    remove: vi.fn(),
    rename: vi.fn(),
    MAX_SAVED: 5,
  }),
}));

// Stub SavedSearchBar to keep tests simple
vi.mock("../Components/MainSearch/SavedSearchBar", () => ({
  default: () => <div data-testid="saved-search-bar" />,
}));

// Stub EncounterSearchResults to avoid full table rendering in EncounterSearch tests
vi.mock("../Components/Encounter/EncounterSearchResults", () => ({
  default: ({
    encounters,
    total,
  }: {
    encounters: unknown[];
    total: number;
  }) => (
    <div data-testid="encounter-results">
      {total} results, {encounters.length} shown
    </div>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeBundle = (count: number) => ({
  resourceType: "Bundle",
  total: count,
  entry: Array.from({ length: count }, (_, i) => ({
    resource: {
      resourceType: "Encounter",
      id: `enc-${i}`,
      status: "finished",
    },
  })),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderSearch = () =>
  render(
    <MemoryRouter>
      <EncounterSearch />
    </MemoryRouter>,
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EncounterSearch", () => {
  beforeEach(() => {
    // Clear sessionStorage so useSessionState starts fresh each test
    sessionStorage.clear();

    mockGetTypes.mockResolvedValue(["Wellness visit", "Office visit"]);
    mockGetClasses.mockResolvedValue(["AMB", "IMP"]);

    // Mock the snomed fetch
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { code: "195967001", display: "Asthma" },
        { code: "44054006", display: "Diabetes mellitus type 2" },
      ],
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Initial rendering ────────────────────────────────────────────────────

  it("renders the Patient ID field", () => {
    renderSearch();
    expect(screen.getByLabelText(/patient id/i)).toBeInTheDocument();
  });

  it("renders the Status dropdown", () => {
    renderSearch();
    // MUI renders the label text in multiple elements; just verify it is present
    expect(screen.getAllByText(/status/i).length).toBeGreaterThan(0);
  });

  it("renders Date From and Date To fields", () => {
    renderSearch();
    expect(screen.getByLabelText(/date from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date to/i)).toBeInTheDocument();
  });

  it("renders the Search Encounters submit button", () => {
    renderSearch();
    expect(
      screen.getByRole("button", { name: /search encounters/i }),
    ).toBeInTheDocument();
  });

  it("renders the Reset button", () => {
    renderSearch();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("renders the saved search bar stub", () => {
    renderSearch();
    expect(screen.getByTestId("saved-search-bar")).toBeInTheDocument();
  });

  it("shows 'Search to get started' before any search", () => {
    renderSearch();
    expect(screen.getByText(/search to get started/i)).toBeInTheDocument();
  });

  // ── Successful search ────────────────────────────────────────────────────

  it("shows results after a successful search", async () => {
    const user = userEvent.setup();
    mockEncounterSearch.mockResolvedValue(makeBundle(3));
    renderSearch();

    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("encounter-results")).toBeInTheDocument(),
    );
    expect(screen.getByText("3 results, 3 shown")).toBeInTheDocument();
  });

  it("hides 'Search to get started' after submitting", async () => {
    const user = userEvent.setup();
    mockEncounterSearch.mockResolvedValue(makeBundle(1));
    renderSearch();

    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );

    await waitFor(() =>
      expect(
        screen.queryByText(/search to get started/i),
      ).not.toBeInTheDocument(),
    );
  });

  // ── Empty results ────────────────────────────────────────────────────────

  it("shows 'No encounters found' when search returns zero results", async () => {
    const user = userEvent.setup();
    mockEncounterSearch.mockResolvedValue(makeBundle(0));
    renderSearch();

    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/no encounters found/i)).toBeInTheDocument(),
    );
  });

  // ── Error state ──────────────────────────────────────────────────────────

  it("shows an error alert when the search fails", async () => {
    const user = userEvent.setup();
    mockEncounterSearch.mockRejectedValue(new Error("Network error"));
    renderSearch();

    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/search failed/i)).toBeInTheDocument();
  });

  // ── Reset ────────────────────────────────────────────────────────────────

  it("resets to initial state on Reset button click", async () => {
    const user = userEvent.setup();
    mockEncounterSearch.mockResolvedValue(makeBundle(2));
    renderSearch();

    // Perform a search first
    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("encounter-results")).toBeInTheDocument(),
    );

    // Reset
    await user.click(screen.getByRole("button", { name: /reset/i }));

    expect(screen.getByText(/search to get started/i)).toBeInTheDocument();
    expect(screen.queryByTestId("encounter-results")).not.toBeInTheDocument();
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it("disables the Search button while loading", async () => {
    const user = userEvent.setup();
    // Never resolves
    mockEncounterSearch.mockImplementation(() => new Promise(() => {}));
    renderSearch();

    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );

    expect(
      screen.getByRole("button", { name: /search encounters/i }),
    ).toBeDisabled();
  });

  it("disables the Reset button while loading", async () => {
    const user = userEvent.setup();
    mockEncounterSearch.mockImplementation(() => new Promise(() => {}));
    renderSearch();

    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );

    expect(screen.getByRole("button", { name: /reset/i })).toBeDisabled();
  });

  // ── Patient ID field ─────────────────────────────────────────────────────

  it("includes patient value in search params", async () => {
    const user = userEvent.setup();
    mockEncounterSearch.mockResolvedValue(makeBundle(0));
    renderSearch();

    // fireEvent.change is more reliable than userEvent.type for controlled MUI inputs
    fireEvent.change(screen.getByLabelText(/patient id/i), {
      target: { name: "patient", value: "pat-xyz" },
    });
    await user.click(
      screen.getByRole("button", { name: /search encounters/i }),
    );

    await waitFor(() => expect(mockEncounterSearch).toHaveBeenCalled());
    const params: URLSearchParams = mockEncounterSearch.mock.calls[0][0];
    expect(params.get("patient")).toBe("pat-xyz");
  });
});
