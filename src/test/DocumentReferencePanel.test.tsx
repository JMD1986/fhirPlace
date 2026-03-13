import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DocumentReferencePanel from "../Components/Encounter/DocumentReferencePanel";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFhirSearch = vi.fn();
vi.mock("../api/fhirApi", () => ({
  fhirSearch: (...args: unknown[]) => mockFhirSearch(...args),
  encounterApi: {},
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ENCOUNTER_ID = "enc-test-001";
const PATIENT_ID = "pat-test-001";

const emptyBundle = () => ({
  resourceType: "Bundle",
  total: 0,
  entry: [],
});

const bundleWithItems = (
  resourceType: string,
  items: { id: string; [key: string]: unknown }[],
) => ({
  resourceType: "Bundle",
  total: items.length,
  entry: items.map((resource) => ({ resource: { resourceType, ...resource } })),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderPanel = (encounterId = ENCOUNTER_ID, patientId?: string) =>
  render(
    <MemoryRouter>
      <DocumentReferencePanel encounterId={encounterId} patientId={patientId} />
    </MemoryRouter>,
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DocumentReferencePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFhirSearch.mockResolvedValue(emptyBundle());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Header always visible ────────────────────────────────────────────────

  it("renders the 'Additional Information' panel header", async () => {
    renderPanel();
    expect(screen.getByText("Additional Information")).toBeInTheDocument();
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it("shows a loading spinner while fetching", () => {
    mockFhirSearch.mockImplementation(() => new Promise(() => {}));
    renderPanel();
    expect(document.querySelector("svg.MuiCircularProgress-svg")).toBeTruthy();
  });

  it("hides the spinner after fetch completes", async () => {
    renderPanel();
    await waitFor(() =>
      expect(document.querySelector("svg.MuiCircularProgress-svg")).toBeNull(),
    );
  });

  // ── Empty state ──────────────────────────────────────────────────────────

  it("shows empty message when all resource types return no results", async () => {
    renderPanel();
    await waitFor(() =>
      expect(
        screen.getByText(/no linked resources found/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows '0 resources linked' caption when all types empty", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/0 resources? linked/i)).toBeInTheDocument(),
    );
  });

  // ── Populated state ──────────────────────────────────────────────────────

  it("renders a group section label for Conditions when present", async () => {
    mockFhirSearch.mockImplementation(
      (_resourceType: string, params: URLSearchParams) => {
        const route = params.toString(); // not important; use call order
        void route;
        return Promise.resolve(emptyBundle());
      },
    );
    // Make the Condition fetch (second call) return items
    mockFhirSearch
      .mockResolvedValueOnce(emptyBundle()) // DocumentReference
      .mockResolvedValueOnce(bundleWithItems("Condition", [{ id: "cond-001" }])) // Condition
      .mockResolvedValue(emptyBundle()); // rest

    renderPanel();

    await waitFor(() =>
      expect(screen.getByText("Conditions")).toBeInTheDocument(),
    );
  });

  it("shows total linked resource count in caption", async () => {
    // Return 2 documents and 1 condition
    mockFhirSearch
      .mockResolvedValueOnce(
        bundleWithItems("DocumentReference", [
          { id: "doc-001" },
          { id: "doc-002" },
        ]),
      )
      .mockResolvedValueOnce(bundleWithItems("Condition", [{ id: "cond-001" }]))
      .mockResolvedValue(emptyBundle());

    renderPanel();

    await waitFor(() =>
      expect(screen.getByText(/3 resources? linked/i)).toBeInTheDocument(),
    );
  });

  it("shows singular 'resource linked' when only 1 result", async () => {
    mockFhirSearch
      .mockResolvedValueOnce(
        bundleWithItems("DocumentReference", [{ id: "doc-001" }]),
      )
      .mockResolvedValue(emptyBundle());

    renderPanel();

    await waitFor(() =>
      expect(screen.getByText(/1 resource linked/i)).toBeInTheDocument(),
    );
  });

  it("renders linked item labels when Documents are returned", async () => {
    mockFhirSearch
      .mockResolvedValueOnce(
        bundleWithItems("DocumentReference", [
          {
            id: "doc-001",
            type: { text: "Discharge Summary" },
          },
        ]),
      )
      .mockResolvedValue(emptyBundle());

    renderPanel();

    await waitFor(() =>
      expect(screen.getByText("Discharge Summary")).toBeInTheDocument(),
    );
  });

  it("renders the Documents group section label", async () => {
    mockFhirSearch
      .mockResolvedValueOnce(
        bundleWithItems("DocumentReference", [{ id: "doc-001" }]),
      )
      .mockResolvedValue(emptyBundle());

    renderPanel();

    await waitFor(() =>
      expect(screen.getByText("Documents")).toBeInTheDocument(),
    );
  });

  // ── Links include encounterId and patientId ───────────────────────────────

  it("includes encounterId in the item link href", async () => {
    mockFhirSearch
      .mockResolvedValueOnce(
        bundleWithItems("DocumentReference", [{ id: "doc-001" }]),
      )
      .mockResolvedValue(emptyBundle());

    renderPanel(ENCOUNTER_ID, PATIENT_ID);

    await waitFor(() =>
      expect(screen.getByText("Documents")).toBeInTheDocument(),
    );

    const links = document.querySelectorAll("a[href]");
    const itemLink = Array.from(links).find((el) =>
      el.getAttribute("href")?.includes(ENCOUNTER_ID),
    );
    expect(itemLink).toBeTruthy();
  });

  it("includes patientId in the item link href when provided", async () => {
    mockFhirSearch
      .mockResolvedValueOnce(
        bundleWithItems("DocumentReference", [{ id: "doc-001" }]),
      )
      .mockResolvedValue(emptyBundle());

    renderPanel(ENCOUNTER_ID, PATIENT_ID);

    await waitFor(() =>
      expect(screen.getByText("Documents")).toBeInTheDocument(),
    );

    const links = document.querySelectorAll("a[href]");
    const itemLink = Array.from(links).find((el) =>
      el.getAttribute("href")?.includes(PATIENT_ID),
    );
    expect(itemLink).toBeTruthy();
  });

  // ── No fetch when encounterId is empty ───────────────────────────────────

  it("does not fetch when encounterId is empty", () => {
    renderPanel("");
    expect(mockFhirSearch).not.toHaveBeenCalled();
  });
});
