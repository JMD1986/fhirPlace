import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BillingDashboard from "../Components/Patient/BillingDashboard";

// ── Mocks ──────────────────────────────────────────────────────────────────────

// recharts' ResponsiveContainer measures DOM dimensions which are 0 in jsdom.
// Replace the entire module with lightweight stand-ins.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Bar: () => null,
  Line: () => null,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const mockClaimSearch = vi.fn();
const mockEobSearch = vi.fn();
vi.mock("../api/fhirApi", () => ({
  claimApi: { search: (...args: unknown[]) => mockClaimSearch(...args) },
  eobApi: { search: (...args: unknown[]) => mockEobSearch(...args) },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeClaim = (id: string, total: number, type = "institutional") => ({
  resourceType: "Claim",
  id,
  status: "active",
  use: "claim",
  created: "2024-01-15",
  billablePeriod: { start: "2024-01-15" },
  total: { value: total },
  type: { text: type },
  insurance: [{ coverage: { display: "Medicare" } }],
});

const makeEob = (id: string, payment: number, benefit: number) => ({
  resourceType: "ExplanationOfBenefit",
  id,
  status: "active",
  created: "2024-01-20",
  billablePeriod: { start: "2024-01-20" },
  payment: { amount: { value: payment } },
  total: [
    {
      category: { coding: [{ code: "benefit", display: "Benefit Amount" }] },
      amount: { value: benefit },
    },
  ],
});

const emptyBundle = () => ({ resourceType: "Bundle", total: 0, entry: [] });

const claimBundle = (claims: ReturnType<typeof makeClaim>[]) => ({
  resourceType: "Bundle",
  total: claims.length,
  entry: claims.map((resource) => ({ resource })),
});

const eobBundle = (eobs: ReturnType<typeof makeEob>[]) => ({
  resourceType: "Bundle",
  total: eobs.length,
  entry: eobs.map((resource) => ({ resource })),
});

// ── Helper ─────────────────────────────────────────────────────────────────────

const renderDashboard = (patientId = "pat-001") =>
  render(
    <MemoryRouter>
      <BillingDashboard patientId={patientId} />
    </MemoryRouter>,
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BillingDashboard", () => {
  beforeEach(() => {
    mockClaimSearch.mockClear();
    mockEobSearch.mockClear();
    mockClaimSearch.mockResolvedValue(emptyBundle());
    mockEobSearch.mockResolvedValue(emptyBundle());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading spinner while fetching", () => {
    mockClaimSearch.mockImplementation(() => new Promise(() => {}));
    mockEobSearch.mockImplementation(() => new Promise(() => {}));
    renderDashboard();
    expect(document.querySelector("svg.MuiCircularProgress-svg")).toBeTruthy();
  });

  it("shows an error alert when either fetch fails", async () => {
    mockClaimSearch.mockRejectedValue(new Error("Service unavailable"));
    renderDashboard();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/service unavailable/i)).toBeInTheDocument();
  });

  it("shows 'No billing data found' when claims and EOBs are empty", async () => {
    renderDashboard();
    await waitFor(() =>
      expect(
        screen.getByText(/no billing data found for this patient/i),
      ).toBeInTheDocument(),
    );
  });

  it("renders Billing Summary heading when data is present", async () => {
    mockClaimSearch.mockResolvedValue(
      claimBundle([makeClaim("c1", 1000), makeClaim("c2", 2000)]),
    );
    mockEobSearch.mockResolvedValue(eobBundle([makeEob("e1", 500, 800)]));
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText(/billing summary/i)).toBeInTheDocument(),
    );
  });

  it("renders stat cards for total submitted, paid, benefit, and avg", async () => {
    mockClaimSearch.mockResolvedValue(
      claimBundle([makeClaim("c1", 1000), makeClaim("c2", 2000)]),
    );
    mockEobSearch.mockResolvedValue(eobBundle([makeEob("e1", 500, 800)]));
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText("Total Submitted")).toBeInTheDocument(),
    );
    expect(screen.getByText("Total Paid Out")).toBeInTheDocument();
    expect(screen.getByText("Benefit Amount")).toBeInTheDocument();
    expect(screen.getByText("Avg Cost / Claim")).toBeInTheDocument();
  });

  it("displays total submitted amount as formatted USD", async () => {
    mockClaimSearch.mockResolvedValue(claimBundle([makeClaim("c1", 1234)]));
    mockEobSearch.mockResolvedValue(eobBundle([makeEob("e1", 0, 0)]));
    renderDashboard();
    // $1,234 appears in both Total Submitted and Avg Cost/Claim for a single claim
    await waitFor(() =>
      expect(screen.getAllByText(/\$1,234/).length).toBeGreaterThan(0),
    );
  });

  it("shows claims count chip", async () => {
    mockClaimSearch.mockResolvedValue(
      claimBundle([
        makeClaim("c1", 100),
        makeClaim("c2", 200),
        makeClaim("c3", 300),
      ]),
    );
    mockEobSearch.mockResolvedValue(eobBundle([makeEob("e1", 0, 0)]));
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText("3 claims")).toBeInTheDocument(),
    );
  });

  it("renders the Recent Claims table with correct rows", async () => {
    mockClaimSearch.mockResolvedValue(
      claimBundle([
        makeClaim("c1", 500, "professional"),
        makeClaim("c2", 750, "institutional"),
      ]),
    );
    mockEobSearch.mockResolvedValue(eobBundle([makeEob("e1", 300, 400)]));
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText("Recent Claims")).toBeInTheDocument(),
    );
    // both claim types should appear in the table
    expect(screen.getAllByText("professional").length).toBeGreaterThan(0);
    expect(screen.getAllByText("institutional").length).toBeGreaterThan(0);
  });

  it("does not fetch when patientId is empty", () => {
    renderDashboard("");
    expect(mockClaimSearch).not.toHaveBeenCalled();
    expect(mockEobSearch).not.toHaveBeenCalled();
  });

  it("passes correct patient query param to both APIs", async () => {
    renderDashboard("pat-xyz");
    await waitFor(() => expect(mockClaimSearch).toHaveBeenCalled());
    const [params] = mockClaimSearch.mock.calls[0] as [URLSearchParams];
    expect(params.get("patient")).toBe("pat-xyz");
    const [eobParams] = mockEobSearch.mock.calls[0] as [URLSearchParams];
    expect(eobParams.get("patient")).toBe("pat-xyz");
  });
});
