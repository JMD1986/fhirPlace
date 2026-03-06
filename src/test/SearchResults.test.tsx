import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SearchResults from "../Components/Patient/SearchResults";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// boring-avatars renders an SVG — stub it to keep snapshots stable
vi.mock("boring-avatars", () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="avatar">{name}</div>
  ),
}));

const makePatient = (overrides: Record<string, unknown> = {}) => ({
  resourceType: "Patient" as const,
  id: "pat-001",
  name: [{ given: ["Alice123"], family: "Smith456" }],
  birthDate: "1990-04-15",
  address: [
    {
      line: ["123 Main St"],
      city: "Springfield",
      state: "IL",
      postalCode: "62701",
    },
  ],
  telecom: [],
  communication: [{ language: { text: "English" } }],
  ...overrides,
});

const DEFAULT_PROPS = {
  patients: [makePatient()],
  total: 1,
  page: 0,
  pageSize: 25,
  onPageChange: vi.fn(),
};

const renderResults = (props = {}) =>
  render(
    <MemoryRouter>
      <SearchResults {...DEFAULT_PROPS} {...props} />
    </MemoryRouter>,
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SearchResults", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty-state message when patients array is empty", () => {
    renderResults({ patients: [], total: 0 });
    expect(
      screen.getByText(/no patients found matching your search criteria/i),
    ).toBeInTheDocument();
  });

  it("renders a row for each patient", () => {
    const patients = [makePatient({ id: "a" }), makePatient({ id: "b" })];
    renderResults({ patients, total: 2 });
    // Each row shows the patient id in a monospace cell
    expect(screen.getByTitle("a")).toBeInTheDocument();
    expect(screen.getByTitle("b")).toBeInTheDocument();
  });

  it("strips numeric suffixes from displayed name", () => {
    renderResults();
    // Alice123 Smith456 → Alice Smith (rendered in both avatar stub and table cell)
    expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);
  });

  it("renders birth date", () => {
    renderResults();
    expect(screen.getByText("1990-04-15")).toBeInTheDocument();
  });

  it("renders formatted address", () => {
    renderResults();
    expect(
      // getAddress joins parts with ", " so state and postalCode are separate
      screen.getByTitle("123 Main St, Springfield, IL, 62701"),
    ).toBeInTheDocument();
  });

  it("renders language", () => {
    renderResults();
    expect(screen.getByText("English")).toBeInTheDocument();
  });

  it('renders "—" when address is missing', () => {
    renderResults({ patients: [makePatient({ address: [] })] });
    expect(screen.getByTitle("—")).toBeInTheDocument();
  });

  it('renders "—" when language is missing', () => {
    renderResults({ patients: [makePatient({ communication: [] })] });
    const rows = screen.getAllByRole("row");
    // The data row should contain at least one "—"
    const dataRow = rows[1];
    expect(within(dataRow).getByText("—")).toBeInTheDocument();
  });

  it("navigates to /patient/:id on View click", async () => {
    const user = userEvent.setup();
    renderResults();
    await user.click(screen.getByRole("button", { name: /view/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/patient/pat-001");
  });

  it("calls onView callback if provided", async () => {
    const onView = vi.fn();
    const user = userEvent.setup();
    renderResults({ onView });
    await user.click(screen.getByRole("button", { name: /view/i }));
    expect(onView).toHaveBeenCalledWith("pat-001");
  });

  it("shows total count summary line", () => {
    renderResults({ total: 42 });
    expect(screen.getByText(/42 patient\(s\) found/i)).toBeInTheDocument();
  });

  it("does not render pagination when total <= pageSize", () => {
    renderResults({ total: 10, pageSize: 25 });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders pagination when total > pageSize", () => {
    renderResults({ total: 100, patients: [makePatient()], pageSize: 25 });
    // MUI TablePagination renders navigation arrows
    expect(screen.getByLabelText(/next page/i)).toBeInTheDocument();
  });
});
