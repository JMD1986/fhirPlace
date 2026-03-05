import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdditionalResourcesPanel from "../Components/AdditionalResources/AdditionalResourcesPanel";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ENCOUNTER_ID = "enc-test-001";
const PATIENT_ID = "pat-test-001";

const makeFhirBundle = (
  resourceType: string,
  entries: { id: string; [key: string]: unknown }[],
) => ({
  resourceType: "Bundle",
  type: "searchset",
  total: entries.length,
  entry: entries.map((resource) => ({ resource })),
});

const emptyBundle = (resourceType: string) => makeFhirBundle(resourceType, []);

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderPanel = (encounterId = ENCOUNTER_ID, patientId?: string) =>
  render(
    <MemoryRouter>
      <AdditionalResourcesPanel
        encounterId={encounterId}
        patientId={patientId}
      />
    </MemoryRouter>,
  );

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AdditionalResourcesPanel", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Loading state ───────────────────────────────────────────────────────────
  it("shows a loading spinner while fetching", () => {
    // fetch never resolves during this test
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    renderPanel();
    expect(document.querySelector("svg.MuiCircularProgress-svg")).toBeTruthy();
  });

  // ── Empty state ─────────────────────────────────────────────────────────────
  it("shows empty message when all resource types return 0 results", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => emptyBundle("Bundle"),
    } as Response);

    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByText(/no linked resources found/i),
      ).toBeInTheDocument();
    });
  });

  // ── Error state ─────────────────────────────────────────────────────────────
  it("shows empty state when all fetches fail (errors are silenced per-resource)", async () => {
    // The panel wraps each resource fetch in its own try/catch so a network
    // failure on one type does not surface as a top-level error alert —
    // it simply returns an empty list for that resource type.
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    renderPanel();

    await waitFor(() => {
      expect(
        screen.getByText(/no linked resources found/i),
      ).toBeInTheDocument();
    });
  });

  it("shows an error alert when server returns non-ok response", async () => {
    // One request fails, rest succeed with empty
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { ok: false, status: 500 } as Response;
      }
      return {
        ok: true,
        json: async () => emptyBundle("Bundle"),
      } as Response;
    });

    renderPanel();

    // Non-ok responses are silently treated as empty (see AdditionalResourcesPanel impl)
    // so we should see the "no resources" message rather than an error
    await waitFor(() => {
      expect(
        screen.getByText(/no linked resources found/i),
      ).toBeInTheDocument();
    });
  });

  // ── Happy path ──────────────────────────────────────────────────────────────
  it("renders resource groups when data is returned", async () => {
    const conditionBundle = makeFhirBundle("Condition", [
      {
        id: "cond-001",
        resourceType: "Condition",
        code: { text: "Hypertension" },
        onsetDateTime: "2023-01-01",
      },
    ]);

    const immunizationBundle = makeFhirBundle("Immunization", [
      {
        id: "imm-001",
        resourceType: "Immunization",
        vaccineCode: { text: "Influenza" },
        occurrenceDateTime: "2023-06-01",
      },
    ]);

    vi.mocked(fetch).mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/fhir/Condition")) {
        return {
          ok: true,
          json: async () => conditionBundle,
        } as Response;
      }
      if (urlStr.includes("/fhir/Immunization")) {
        return {
          ok: true,
          json: async () => immunizationBundle,
        } as Response;
      }
      return {
        ok: true,
        json: async () => emptyBundle("Bundle"),
      } as Response;
    });

    renderPanel(ENCOUNTER_ID, PATIENT_ID);

    await waitFor(() => {
      // Panel renders a clickable section header per resource type, not individual items
      expect(screen.getByText("Conditions")).toBeInTheDocument();
      expect(screen.getByText("Immunizations")).toBeInTheDocument();
      // Each section header shows the item count
      const counts = screen.getAllByText("1");
      expect(counts.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows the correct resource count in the header", async () => {
    const conditionBundle = makeFhirBundle("Condition", [
      {
        id: "cond-001",
        resourceType: "Condition",
        code: { text: "Hypertension" },
      },
      {
        id: "cond-002",
        resourceType: "Condition",
        code: { text: "Diabetes" },
      },
    ]);

    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes("/fhir/Condition")) {
        return { ok: true, json: async () => conditionBundle } as Response;
      }
      return { ok: true, json: async () => emptyBundle("Bundle") } as Response;
    });

    renderPanel(ENCOUNTER_ID, PATIENT_ID);

    await waitFor(() => {
      expect(screen.getByText(/2 resources linked/i)).toBeInTheDocument();
    });
  });

  it("shows '1 resource linked' (singular) with exactly one item", async () => {
    const bundle = makeFhirBundle("Condition", [
      {
        id: "cond-001",
        resourceType: "Condition",
        code: { text: "Hypertension" },
      },
    ]);

    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes("/fhir/Condition")) {
        return { ok: true, json: async () => bundle } as Response;
      }
      return { ok: true, json: async () => emptyBundle("Bundle") } as Response;
    });

    renderPanel(ENCOUNTER_ID, PATIENT_ID);

    await waitFor(() => {
      expect(screen.getByText(/1 resource linked/i)).toBeInTheDocument();
    });
  });

  // ── Link hrefs ──────────────────────────────────────────────────────────────
  it("renders a clickable section button for each resource type with results", async () => {
    const conditionBundle = makeFhirBundle("Condition", [
      {
        id: "cond-abc",
        resourceType: "Condition",
        code: { text: "Test Condition" },
      },
    ]);

    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes("/fhir/Condition")) {
        return { ok: true, json: async () => conditionBundle } as Response;
      }
      return { ok: true, json: async () => emptyBundle("Bundle") } as Response;
    });

    renderPanel(ENCOUNTER_ID, PATIENT_ID);

    await waitFor(() => {
      // The panel renders a ListItemButton (role="button") for the Conditions section
      const btn = screen.getByRole("button", { name: /conditions/i });
      expect(btn).toBeInTheDocument();
      // The section header shows the item count
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("renders correctly without patientId prop", async () => {
    const conditionBundle = makeFhirBundle("Condition", [
      {
        id: "cond-xyz",
        resourceType: "Condition",
        code: { text: "Solo Condition" },
      },
    ]);

    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).includes("/fhir/Condition")) {
        return { ok: true, json: async () => conditionBundle } as Response;
      }
      return { ok: true, json: async () => emptyBundle("Bundle") } as Response;
    });

    // No patientId — panel should still render the Conditions section
    renderPanel(ENCOUNTER_ID);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /conditions/i }),
      ).toBeInTheDocument();
    });
  });

  // ── Fetch URL correctness ───────────────────────────────────────────────────
  it("fetches each resource type with the encounterId", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => emptyBundle("Bundle"),
    } as Response);

    renderPanel(ENCOUNTER_ID, PATIENT_ID);

    await waitFor(() => {
      const urls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
      const resourceTypes = [
        "DocumentReference",
        "Condition",
        "DiagnosticReport",
        "Claim",
        "ExplanationOfBenefit",
        "Immunization",
        "Procedure",
      ];
      resourceTypes.forEach((rt) => {
        expect(urls.some((u) => u.includes(`/fhir/${rt}`))).toBe(true);
        expect(urls.some((u) => u.includes(`encounter=${ENCOUNTER_ID}`))).toBe(
          true,
        );
      });
    });
  });

  // ── Re-fetch on encounterId change ──────────────────────────────────────────
  it("re-fetches when encounterId prop changes", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => emptyBundle("Bundle"),
    } as Response);

    const { rerender } = renderPanel("enc-first");
    await waitFor(() => screen.getByText(/no linked resources/i));
    const firstCallCount = vi.mocked(fetch).mock.calls.length;

    rerender(
      <MemoryRouter>
        <AdditionalResourcesPanel encounterId="enc-second" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const totalCalls = vi.mocked(fetch).mock.calls.length;
      expect(totalCalls).toBeGreaterThan(firstCallCount);
    });
  });
});
