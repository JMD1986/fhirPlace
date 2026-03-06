import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EncounterView from "../Components/Encounter/EncounterView";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetById = vi.fn();
vi.mock("../api/fhirApi", () => ({
  encounterApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    search: vi.fn(),
    getTypes: vi.fn().mockResolvedValue([]),
    getClasses: vi.fn().mockResolvedValue([]),
  },
  fhirSearch: vi
    .fn()
    .mockResolvedValue({ resourceType: "Bundle", total: 0, entry: [] }),
}));

// Control useFHIRResource output directly
const mockUseFHIRResource = vi.fn();
vi.mock("../hooks/useFHIRResource", () => ({
  useFHIRResource: (...args: unknown[]) => mockUseFHIRResource(...args),
}));

// Stub NPPES hooks – these hit live APIs and aren't relevant to these tests
vi.mock("../hooks/useNPPES", () => ({
  useNPPESPractitioner: () => ({
    results: [],
    loading: false,
    error: null,
    searchedBy: null,
  }),
  useNPPESOrg: () => ({
    results: [],
    loading: false,
    error: null,
    searchedBy: null,
  }),
  extractNPIFromReference: () => null,
}));

// Stub AdditionalResourcesPanel to avoid fhirSearch chatter
vi.mock("../Components/AdditionalResources/AdditionalResourcesPanel", () => ({
  default: ({ onSelectGroup }: { onSelectGroup: (g: unknown) => void }) => (
    <div data-testid="additional-resources-panel">
      <button
        onClick={() =>
          onSelectGroup({
            config: {
              resourceType: "Condition",
              label: "Conditions",
              icon: null,
              getLabel: () => "Cond",
              getDate: () => null,
            },
            items: [{ id: "cond-001" }],
          })
        }
      >
        Open Conditions
      </button>
    </div>
  ),
}));

// Stub inline resource views
vi.mock("../Components/AdditionalResources/ConditionView", () => ({
  default: () => <div data-testid="condition-view" />,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ENCOUNTER_ID = "enc-001";

const baseEncounter = {
  resourceType: "Encounter",
  id: ENCOUNTER_ID,
  status: "finished",
  class: { code: "AMB" },
  type: [{ text: "Office Visit" }],
  subject: {
    reference: "Patient/pat-001",
    display: "Jane123 Doe456",
  },
  _patientId: "pat-001",
  period: {
    start: "2024-06-15T09:00:00Z",
    end: "2024-06-15T09:30:00Z",
  },
  participant: [
    {
      type: [{ text: "Primary performer" }],
      period: { start: "2024-06-15T09:00:00Z", end: "2024-06-15T09:30:00Z" },
      individual: { display: "Dr. Smith", reference: "Practitioner/prac-001" },
    },
  ],
  location: [{ location: { display: "General Hospital" } }],
  serviceProvider: { display: "General Hospital" },
  diagnosis: [
    {
      condition: { display: "Hypertension" },
      role: { text: "Chief complaint" },
      rank: 1,
    },
  ],
  reason: [{ text: "Annual checkup" }],
};

// ── Helper ────────────────────────────────────────────────────────────────────

const renderView = (encounterId = ENCOUNTER_ID) =>
  render(
    <MemoryRouter initialEntries={[`/encounter/${encounterId}`]}>
      <Routes>
        <Route path="/encounter/:id" element={<EncounterView />} />
        <Route path="/" element={<div data-testid="home" />} />
        <Route
          path="/patient/:id"
          element={<div data-testid="patient-view" />}
        />
      </Routes>
    </MemoryRouter>,
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EncounterView", () => {
  beforeEach(() => {
    mockUseFHIRResource.mockReturnValue({
      data: baseEncounter,
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it("shows a loading spinner while fetching", () => {
    mockUseFHIRResource.mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    renderView();
    expect(document.querySelector("svg.MuiCircularProgress-svg")).toBeTruthy();
  });

  it("does not render encounter content while loading", () => {
    mockUseFHIRResource.mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });
    renderView();
    expect(screen.queryByText("Office Visit")).not.toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────────────────

  it("shows an error alert on fetch failure", () => {
    mockUseFHIRResource.mockReturnValue({
      data: null,
      loading: false,
      error: "Not found",
    });
    renderView();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  // ── Main details ─────────────────────────────────────────────────────────

  it("renders the encounter type as the page heading", () => {
    renderView();
    expect(
      screen.getByRole("heading", { name: "Office Visit" }),
    ).toBeInTheDocument();
  });

  it("renders the patient display name (numerics stripped)", () => {
    renderView();
    // The subtitle line and the patient link both contain "Jane Doe"
    expect(screen.getAllByText(/jane doe/i).length).toBeGreaterThan(0);
  });

  it("renders the encounter ID in the details table", () => {
    renderView();
    expect(screen.getByText(ENCOUNTER_ID)).toBeInTheDocument();
  });

  it("renders the status chip", () => {
    renderView();
    expect(screen.getByText("finished")).toBeInTheDocument();
  });

  it("renders the class chip", () => {
    renderView();
    expect(screen.getByText("AMB")).toBeInTheDocument();
  });

  it("renders the start date", () => {
    renderView();
    // formatDateTime renders something like "Jun 15, 2024, 04:00 AM"
    // Multiple elements may contain this text (main table + participants)
    expect(screen.getAllByText(/jun 15, 2024/i).length).toBeGreaterThan(0);
  });

  it("renders the location", () => {
    renderView();
    const locationTexts = screen.getAllByText("General Hospital");
    expect(locationTexts.length).toBeGreaterThan(0);
  });

  it("renders the reason chip", () => {
    renderView();
    expect(screen.getByText("Annual checkup")).toBeInTheDocument();
  });

  // ── Participants ─────────────────────────────────────────────────────────

  it("renders the Participants section heading", () => {
    renderView();
    expect(screen.getByText("Participants")).toBeInTheDocument();
  });

  it("renders the participant name in the table", () => {
    renderView();
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
  });

  it("renders the participant role", () => {
    renderView();
    expect(screen.getByText("Primary performer")).toBeInTheDocument();
  });

  // ── Diagnoses ────────────────────────────────────────────────────────────

  it("renders the Diagnoses section heading", () => {
    renderView();
    expect(screen.getByText("Diagnoses")).toBeInTheDocument();
  });

  it("renders the diagnosis condition display", () => {
    renderView();
    expect(screen.getByText("Hypertension")).toBeInTheDocument();
  });

  it("renders the diagnosis role", () => {
    renderView();
    expect(screen.getByText("Chief complaint")).toBeInTheDocument();
  });

  it("renders the diagnosis rank", () => {
    renderView();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  // ── Navigation ───────────────────────────────────────────────────────────

  it("renders a Back to search button", () => {
    renderView();
    expect(
      screen.getByRole("button", { name: /back to search/i }),
    ).toBeInTheDocument();
  });

  it("navigates home when Back to search is clicked", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("button", { name: /back to search/i }));
    await waitFor(() => expect(screen.getByTestId("home")).toBeInTheDocument());
  });

  it("renders patient as a link when patientId is available", () => {
    renderView();
    const patientLink = screen.getByRole("link", { name: /jane doe/i });
    expect(patientLink).toBeInTheDocument();
    expect(patientLink.getAttribute("href")).toContain("pat-001");
  });

  // ── AdditionalResourcesPanel integration ─────────────────────────────────

  it("renders the AdditionalResourcesPanel stub", () => {
    renderView();
    expect(
      screen.getByTestId("additional-resources-panel"),
    ).toBeInTheDocument();
  });

  it("shows a resource list view when a group is selected from the panel", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole("button", { name: /open conditions/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /back to encounter/i }),
      ).toBeInTheDocument(),
    );
  });

  it("returns to encounter detail on '← Back to Encounter' click", async () => {
    const user = userEvent.setup();
    renderView();

    // Select a group
    await user.click(screen.getByRole("button", { name: /open conditions/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /back to encounter/i }),
      ).toBeInTheDocument(),
    );

    // Go back
    await user.click(
      screen.getByRole("button", { name: /back to encounter/i }),
    );
    await waitFor(() =>
      expect(screen.getByText("Participants")).toBeInTheDocument(),
    );
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  it("renders nothing (null) when data is null and not loading/error", () => {
    mockUseFHIRResource.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });
    const { container } = renderView();
    // Should render empty (null guard)
    expect(container.firstChild).toBeNull();
  });

  it("does not show Participants section when there are no participants", () => {
    mockUseFHIRResource.mockReturnValue({
      data: { ...baseEncounter, participant: [] },
      loading: false,
      error: null,
    });
    renderView();
    expect(screen.queryByText("Participants")).not.toBeInTheDocument();
  });

  it("does not show Diagnoses section when there are no diagnoses", () => {
    mockUseFHIRResource.mockReturnValue({
      data: { ...baseEncounter, diagnosis: [] },
      loading: false,
      error: null,
    });
    renderView();
    expect(screen.queryByText("Diagnoses")).not.toBeInTheDocument();
  });
});
