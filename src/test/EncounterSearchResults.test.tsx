import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import EncounterSearchResults, {
  getType,
  getPatientDisplay,
  getPractitioner,
  getLocation,
  formatDate,
  statusColor,
} from "../Components/Encounter/EncounterSearchResults";
import type { FhirEncounter } from "../Components/Encounter/EncounterSearchResults";

// ── Mock react-router navigate ────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => mockNavigate };
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseEncounter: FhirEncounter = {
  resourceType: "Encounter",
  id: "enc-001",
  status: "finished",
  class: { code: "AMB" },
  type: [{ text: "Office Visit", coding: [{ display: "Office Visit" }] }],
  subject: { display: "John123 Doe456", reference: "Patient/pat-001" },
  participant: [{ individual: { display: "Dr. Smith789" } }],
  period: { start: "2024-06-15T09:00:00Z", end: "2024-06-15T09:30:00Z" },
  location: [{ location: { display: "General Hospital" } }],
};

const renderResults = (
  encounters: FhirEncounter[] = [baseEncounter],
  total: number | null = 1,
  page = 0,
  pageSize = 25,
) =>
  render(
    <MemoryRouter>
      <EncounterSearchResults
        encounters={encounters}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={vi.fn()}
      />
    </MemoryRouter>,
  );

// ── Utility function unit tests ───────────────────────────────────────────────

describe("getType", () => {
  it("returns type text when present", () => {
    expect(getType(baseEncounter)).toBe("Office Visit");
  });

  it("falls back to coding display when no text", () => {
    const enc: FhirEncounter = {
      ...baseEncounter,
      type: [{ coding: [{ display: "Telemedicine" }] }],
    };
    expect(getType(enc)).toBe("Telemedicine");
  });

  it("returns '—' when no type", () => {
    const enc: FhirEncounter = { ...baseEncounter, type: undefined };
    expect(getType(enc)).toBe("—");
  });
});

describe("getPatientDisplay", () => {
  it("strips numeric suffixes from display name", () => {
    expect(getPatientDisplay(baseEncounter)).toBe("John Doe");
  });

  it("returns empty string for missing subject display", () => {
    const enc: FhirEncounter = { ...baseEncounter, subject: undefined };
    expect(getPatientDisplay(enc)).toBe("");
  });
});

describe("getPractitioner", () => {
  it("returns the first participant display", () => {
    expect(getPractitioner(baseEncounter)).toBe("Dr. Smith789");
  });

  it("returns '—' when no participants", () => {
    const enc: FhirEncounter = { ...baseEncounter, participant: [] };
    expect(getPractitioner(enc)).toBe("—");
  });
});

describe("getLocation", () => {
  it("returns first location display", () => {
    expect(getLocation(baseEncounter)).toBe("General Hospital");
  });

  it("falls back to serviceProvider display", () => {
    const enc: FhirEncounter = {
      ...baseEncounter,
      location: undefined,
      serviceProvider: { display: "City Clinic" },
    };
    expect(getLocation(enc)).toBe("City Clinic");
  });

  it("returns '—' when neither present", () => {
    const enc: FhirEncounter = {
      ...baseEncounter,
      location: undefined,
      serviceProvider: undefined,
    };
    expect(getLocation(enc)).toBe("—");
  });
});

describe("formatDate", () => {
  it("extracts first 10 chars of ISO string", () => {
    expect(formatDate("2024-06-15T09:00:00Z")).toBe("2024-06-15");
  });

  it("returns '—' for undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("statusColor", () => {
  it("maps finished → success", () => {
    expect(statusColor("finished")).toBe("success");
  });

  it("maps in-progress → warning", () => {
    expect(statusColor("in-progress")).toBe("warning");
  });

  it("maps cancelled → error", () => {
    expect(statusColor("cancelled")).toBe("error");
  });

  it("returns default for unknown status", () => {
    expect(statusColor("planned")).toBe("default");
    expect(statusColor(undefined)).toBe("default");
  });
});

// ── Component rendering tests ────────────────────────────────────────────────

describe("EncounterSearchResults", () => {
  it("shows total count header", () => {
    renderResults([baseEncounter], 5);
    expect(screen.getByText("5 encounter(s) found")).toBeInTheDocument();
  });

  it("uses encounters.length when total is null", () => {
    renderResults([baseEncounter], null);
    expect(screen.getByText("1 encounter(s) found")).toBeInTheDocument();
  });

  it("renders patient name with numerics stripped", () => {
    renderResults();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders encounter type", () => {
    renderResults();
    expect(screen.getByText("Office Visit")).toBeInTheDocument();
  });

  it("renders class chip", () => {
    renderResults();
    expect(screen.getByText("AMB")).toBeInTheDocument();
  });

  it("renders status chip", () => {
    renderResults();
    expect(screen.getByText("finished")).toBeInTheDocument();
  });

  it("renders start date", () => {
    renderResults();
    expect(screen.getByText("2024-06-15")).toBeInTheDocument();
  });

  it("renders practitioner display", () => {
    renderResults();
    expect(screen.getByText("Dr. Smith789")).toBeInTheDocument();
  });

  it("renders location display", () => {
    renderResults();
    expect(screen.getByText("General Hospital")).toBeInTheDocument();
  });

  it("renders a View button for each encounter", () => {
    renderResults([baseEncounter, { ...baseEncounter, id: "enc-002" }], 2);
    expect(screen.getAllByRole("button", { name: /view/i })).toHaveLength(2);
  });

  it("navigates to /encounter/:id on View click", async () => {
    const user = userEvent.setup();
    renderResults();
    await user.click(screen.getByRole("button", { name: /view/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/encounter/enc-001");
  });

  it("shows 'No encounters found' row when encounters list is empty", () => {
    renderResults([], 0);
    expect(screen.getByText("No encounters found.")).toBeInTheDocument();
  });

  it("renders pagination when total exceeds pageSize", () => {
    renderResults([baseEncounter], 100, 0, 25);
    // TablePagination renders navigation buttons
    expect(
      document.querySelector(".MuiTablePagination-root"),
    ).toBeInTheDocument();
  });

  it("does not render pagination when total is within one page", () => {
    renderResults([baseEncounter], 10, 0, 25);
    expect(document.querySelector(".MuiTablePagination-root")).toBeNull();
  });

  it("renders all table column headers", () => {
    renderResults();
    for (const header of [
      "Patient",
      "Type",
      "Class",
      "Status",
      "Date",
      "Practitioner",
      "Location",
    ]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
  });
});
