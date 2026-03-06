import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PatientView from "../Components/Patient/PatientView";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("boring-avatars", () => ({
  default: ({ name }: { name: string }) => (
    <div data-testid="avatar">{name}</div>
  ),
}));

// PatientEncountersPanel fetches resources — stub fully
vi.mock("../Components/Patient/PatientEncountersPanel", () => ({
  default: ({ patientId }: { patientId: string }) => (
    <div data-testid="encounters-panel" data-patient-id={patientId} />
  ),
}));

// BillingDashboard — stub fully
vi.mock("../Components/Patient/BillingDashboard", () => ({
  default: ({ patientId }: { patientId: string }) => (
    <div data-testid="billing-dashboard" data-patient-id={patientId} />
  ),
}));

const mockGetById = vi.fn();
vi.mock("../api/fhirApi", () => ({
  patientApi: { getById: (...args: unknown[]) => mockGetById(...args) },
  observationApi: {
    search: vi.fn().mockResolvedValue({ entry: [] }),
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PAT_ID = "pat-001";

const patientResource = {
  resourceType: "Patient",
  id: PAT_ID,
  name: [{ prefix: ["Mr."], given: ["John"], family: "Doe" }],
  gender: "male",
  birthDate: "1980-03-12",
  maritalStatus: { text: "Married" },
  telecom: [{ system: "phone", value: "555-123-4567" }],
  address: [
    {
      line: ["42 Elm St"],
      city: "Shelbyville",
      state: "IL",
      postalCode: "62565",
      country: "US",
    },
  ],
  communication: [{ language: { text: "English" } }],
  extension: [
    {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
      extension: [{ url: "text", valueString: "White" }],
    },
    {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
      extension: [{ url: "text", valueString: "Not Hispanic or Latino" }],
    },
    {
      url: "http://hl7.org/fhir/StructureDefinition/patient-birthPlace",
      valueAddress: { city: "Chicago", state: "IL", country: "US" },
    },
  ],
  identifier: [
    { type: { text: "Social Security Number" }, value: "999-99-9999" },
    { type: { text: "Medical Record Number" }, value: "MRN-001" },
  ],
};

// Helper: render PatientView at /patient/:id
const renderView = (id = PAT_ID) =>
  render(
    <MemoryRouter initialEntries={[`/patient/${id}`]}>
      <Routes>
        <Route path="/patient/:id" element={<PatientView />} />
      </Routes>
    </MemoryRouter>,
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PatientView", () => {
  beforeEach(() => {
    mockGetById.mockResolvedValue(patientResource);
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading spinner while fetching", () => {
    mockGetById.mockImplementation(() => new Promise(() => {}));
    renderView();
    expect(document.querySelector("svg.MuiCircularProgress-svg")).toBeTruthy();
  });

  it("shows an error alert when the fetch fails", async () => {
    mockGetById.mockRejectedValue(new Error("Not Found"));
    renderView();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it("renders the patient display name", async () => {
    renderView();
    // The name appears in both the Avatar stub and the h4 heading; target the heading
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /john doe/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders demographic rows in the overview table", async () => {
    renderView();
    await waitFor(() => expect(screen.getByText("Gender")).toBeInTheDocument());
    expect(screen.getByText("Male")).toBeInTheDocument();
    expect(screen.getByText("1980-03-12")).toBeInTheDocument();
    expect(screen.getByText("Married")).toBeInTheDocument();
    expect(screen.getByText("555-123-4567")).toBeInTheDocument();
    expect(
      screen.getByText("42 Elm St, Shelbyville, IL 62565, US"),
    ).toBeInTheDocument();
    expect(screen.getByText("White")).toBeInTheDocument();
    expect(screen.getByText("Not Hispanic or Latino")).toBeInTheDocument();
    expect(screen.getByText("Chicago, IL US")).toBeInTheDocument();
    expect(screen.getByText("999-99-9999")).toBeInTheDocument();
    expect(screen.getByText("MRN-001")).toBeInTheDocument();
  });

  it("extracts patient from a FHIR Bundle response", async () => {
    mockGetById.mockResolvedValue({
      resourceType: "Bundle",
      entry: [{ resource: patientResource }],
    });
    renderView();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /john doe/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders ← Back to search button that calls navigate(-1)", async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() =>
      expect(screen.getByText(/back to search/i)).toBeInTheDocument(),
    );
    await user.click(screen.getByText(/back to search/i));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("renders the PatientEncountersPanel in overview mode", async () => {
    renderView();
    await waitFor(() =>
      expect(screen.getByTestId("encounters-panel")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("encounters-panel")).toHaveAttribute(
      "data-patient-id",
      PAT_ID,
    );
  });

  it("switches to BillingDashboard when Billing tab is clicked", async () => {
    const user = userEvent.setup();
    renderView();
    await waitFor(() =>
      expect(screen.getByText(/billing/i)).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /billing/i }));
    expect(screen.getByTestId("billing-dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("encounters-panel")).not.toBeInTheDocument();
  });

  it("passes patientId prop to the encounters panel", async () => {
    renderView("custom-id-42");
    mockGetById.mockResolvedValue({ ...patientResource, id: "custom-id-42" });
    await waitFor(() =>
      expect(screen.getByTestId("encounters-panel")).toHaveAttribute(
        "data-patient-id",
        "custom-id-42",
      ),
    );
  });
});
