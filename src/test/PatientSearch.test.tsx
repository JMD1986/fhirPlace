import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "test@example.com" } }),
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

vi.mock("boring-avatars", () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="avatar">{name}</div>
  ),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSearch = vi.fn();
vi.mock("../api/fhirApi", () => ({
  patientApi: {
    search: (...args: unknown[]) => mockSearch(...args),
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makePatient = (id: string) => ({
  resourceType: "Patient",
  id,
  name: [{ given: ["Alice"], family: "Smith" }],
  birthDate: "1990-04-15",
  address: [{ city: "Springfield", state: "IL" }],
  communication: [{ language: { text: "English" } }],
});

const bundle = (ids: string[], total?: number) => ({
  resourceType: "Bundle",
  total: total ?? ids.length,
  entry: ids.map((id) => ({ resource: makePatient(id) })),
});

// ── Helper ─────────────────────────────────────────────────────────────────────

const renderPatientSearch = async () => {
  const { default: PatientSearch } =
    await import("../Components/Patient/PatientSearch");
  return render(
    <MemoryRouter>
      <PatientSearch />
    </MemoryRouter>,
  );
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PatientSearch", () => {
  beforeEach(() => {
    mockSearch.mockResolvedValue(bundle([]));
    mockNavigate.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Search to get started" prompt before first search', async () => {
    await renderPatientSearch();
    expect(screen.getByText(/search to get started/i)).toBeInTheDocument();
  });

  it("renders all search fields", async () => {
    await renderPatientSearch();
    expect(screen.getByLabelText(/patient name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/family name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/given name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/birth date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
  });

  it("calls patientApi.search with the entered name on submit", async () => {
    const user = userEvent.setup();
    await renderPatientSearch();
    await user.type(screen.getByLabelText(/patient name/i), "Alice");
    await user.click(screen.getByRole("button", { name: /search patients/i }));
    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    const [params] = mockSearch.mock.calls[0] as [URLSearchParams];
    expect(params.get("name")).toBe("Alice");
  });

  it('shows "No patients found" when search returns empty bundle', async () => {
    mockSearch.mockResolvedValue(bundle([]));
    const user = userEvent.setup();
    await renderPatientSearch();
    await user.click(screen.getByRole("button", { name: /search patients/i }));
    await waitFor(() =>
      expect(screen.getByText(/no patients found/i)).toBeInTheDocument(),
    );
  });

  it("renders result rows when search returns patients", async () => {
    mockSearch.mockResolvedValue(bundle(["pat-001", "pat-002"], 2));
    const user = userEvent.setup();
    await renderPatientSearch();
    await user.click(screen.getByRole("button", { name: /search patients/i }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /view/i })).toHaveLength(2),
    );
  });

  it("shows an error alert when the API throws", async () => {
    mockSearch.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    await renderPatientSearch();
    await user.click(screen.getByRole("button", { name: /search patients/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/failed to search patients/i)).toBeInTheDocument();
  });

  it("clears results and resets to prompt when Clear is clicked", async () => {
    mockSearch.mockResolvedValue(bundle(["pat-001"], 1));
    const user = userEvent.setup();
    await renderPatientSearch();
    await user.type(screen.getByLabelText(/patient name/i), "Alice");
    await user.click(screen.getByRole("button", { name: /search patients/i }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /view/i })).toHaveLength(1),
    );
    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(screen.getByText(/search to get started/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /view/i }),
    ).not.toBeInTheDocument();
  });

  it("clears input fields when Clear is clicked", async () => {
    const user = userEvent.setup();
    await renderPatientSearch();
    const nameInput = screen.getByLabelText(/patient name/i);
    await user.type(nameInput, "Bob");
    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(nameInput).toHaveValue("");
  });

  it("disables Search and Clear buttons while loading", async () => {
    // Never resolves — keeps loading state active
    mockSearch.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    await renderPatientSearch();
    const searchBtn = screen.getByRole("button", { name: /search patients/i });
    await user.click(searchBtn);
    expect(searchBtn).toBeDisabled();
    expect(screen.getByRole("button", { name: /clear/i })).toBeDisabled();
  });
});
