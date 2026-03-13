import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import PatientEncountersPanel from "../Components/Patient/PatientEncountersPanel";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockFhirSearch = vi.fn();
vi.mock("../api/fhirApi", () => ({
  fhirSearch: (...args: unknown[]) => mockFhirSearch(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PAT_ID = "pat-001";

/** Returns a FHIR bundle with a given total but no entries (summary query). */
const summaryBundle = (total: number) => ({
  resourceType: "Bundle",
  total,
  entry: [],
});

/** Returns a FHIR bundle containing N minimal resources of the given type. */
const itemBundle = (resourceType: string, count: number) => ({
  resourceType: "Bundle",
  total: count,
  entry: Array.from({ length: count }, (_, i) => ({
    resource: { resourceType, id: `${resourceType}-${i}` },
  })),
});

// ── Helper ─────────────────────────────────────────────────────────────────────

const renderPanel = (onSelectResource = vi.fn()) =>
  render(
    <MemoryRouter>
      <PatientEncountersPanel
        patientId={PAT_ID}
        onSelectResource={onSelectResource}
      />
    </MemoryRouter>,
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PatientEncountersPanel", () => {
  beforeEach(() => {
    // Default: every resource type returns 0
    mockFhirSearch.mockResolvedValue(summaryBundle(0));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading spinner while fetching summaries", () => {
    mockFhirSearch.mockImplementation(() => new Promise(() => {}));
    renderPanel();
    expect(document.querySelector("svg.MuiCircularProgress-svg")).toBeTruthy();
  });

  it("shows an error alert when the summary fetch fails", async () => {
    mockFhirSearch.mockRejectedValue(new Error("Server error"));
    renderPanel();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("renders all resource type labels when every type has a non-zero total", async () => {
    // Return total=1 for every resource type so none are filtered out
    mockFhirSearch.mockResolvedValue(summaryBundle(1));
    renderPanel();
    const labels = [
      "Observations",
      "Procedures",
      "Diagnostic Reports",
      "Encounters",
      "Medications",
      "Conditions",
      "Immunizations",
      "Claims",
      "Explanations of Benefit",
      "Documents",
    ];
    await waitFor(() =>
      expect(screen.getByText("Observations")).toBeInTheDocument(),
    );
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("hides resource type rows with a total of 0", async () => {
    // Default beforeEach: all types return total=0 → none should render
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/no records found/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText("Observations")).not.toBeInTheDocument();
  });

  it("renders the total count next to each resource type", async () => {
    // Make Conditions return 42, everything else 0
    mockFhirSearch.mockImplementation((resourceType: string) =>
      resourceType === "Condition"
        ? Promise.resolve(summaryBundle(42))
        : Promise.resolve(summaryBundle(0)),
    );
    renderPanel();
    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
  });

  it("shows '\u2014' when a resource bundle has no total field", async () => {
    // Bundle with no `total` property → component computes null → renders "—"
    mockFhirSearch.mockResolvedValue({ resourceType: "Bundle", entry: [] });
    renderPanel();
    await waitFor(() =>
      expect(screen.getAllByText("\u2014").length).toBeGreaterThan(0),
    );
  });

  it("calls onSelectResource with correct config and items on row click", async () => {
    const onSelectResource = vi.fn();
    const user = userEvent.setup();

    // First call (summary): return totals; subsequent (detail) call: items
    mockFhirSearch
      .mockResolvedValueOnce(summaryBundle(3)) // Observation summary
      .mockResolvedValue(summaryBundle(0)); // rest of the summary calls

    renderPanel(onSelectResource);

    await waitFor(() =>
      expect(screen.getByText("Observations")).toBeInTheDocument(),
    );

    // Detail fetch returns actual items
    mockFhirSearch.mockResolvedValue(itemBundle("Observation", 3));

    await user.click(screen.getByText("Observations"));

    await waitFor(() => expect(onSelectResource).toHaveBeenCalled());
    const [group] = onSelectResource.mock.calls[0] as [
      { config: { resourceType: string }; items: unknown[] },
    ];
    expect(group.config.resourceType).toBe("Observation");
    expect(group.items).toHaveLength(3);
  });

  it("does not call onSelectResource when prop is omitted", async () => {
    const user = userEvent.setup();
    mockFhirSearch.mockResolvedValue(summaryBundle(5));
    render(
      <MemoryRouter>
        <PatientEncountersPanel patientId={PAT_ID} />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText("Observations")).toBeInTheDocument(),
    );
    // Click should not throw or call any callback
    await user.click(screen.getByText("Observations"));
  });
});
