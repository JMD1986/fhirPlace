import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ImmunizationView from "../components/AdditionalResources/ImmunizationView";
import ProcedureView from "../components/AdditionalResources/ProcedureView";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const IMM_ID = "imm-test-001";
const PROC_ID = "proc-test-001";
const ENC_ID = "enc-test-001";
const PAT_ID = "pat-test-001";

const immunizationResource = {
  resourceType: "Immunization",
  id: IMM_ID,
  status: "completed",
  vaccineCode: {
    text: "Influenza, seasonal, injectable, preservative free",
    coding: [
      {
        system: "http://hl7.org/fhir/sid/cvx",
        code: "140",
        display: "Influenza",
      },
    ],
  },
  patient: { reference: `Patient/${PAT_ID}`, display: "Jane Doe" },
  encounter: { reference: `urn:uuid:${ENC_ID}` },
  occurrenceDateTime: "2023-06-01T10:00:00Z",
  primarySource: true,
  location: { display: "Springfield Clinic" },
  _patientId: PAT_ID,
};

const procedureResource = {
  resourceType: "Procedure",
  id: PROC_ID,
  status: "completed",
  code: {
    text: "Blood pressure measurement",
    coding: [{ system: "http://snomed.info/sct", code: "75367002" }],
  },
  subject: { reference: `Patient/${PAT_ID}`, display: "Jane Doe" },
  encounter: { reference: `urn:uuid:${ENC_ID}` },
  performedPeriod: {
    start: "2023-06-01T09:00:00Z",
    end: "2023-06-01T09:30:00Z",
  },
  location: { display: "Springfield Clinic" },
  reasonCode: [{ text: "Annual checkup" }],
  _patientId: PAT_ID,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderImmunizationView(
  id = IMM_ID,
  queryParams = `?encounterId=${ENC_ID}&patientId=${PAT_ID}`,
) {
  return render(
    <MemoryRouter initialEntries={[`/immunization/${id}${queryParams}`]}>
      <Routes>
        <Route path="/immunization/:id" element={<ImmunizationView />} />
        <Route path="/encounter/:id" element={<div>Encounter Page</div>} />
        <Route path="/patient/:id" element={<div>Patient Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderProcedureView(
  id = PROC_ID,
  queryParams = `?encounterId=${ENC_ID}&patientId=${PAT_ID}`,
) {
  return render(
    <MemoryRouter initialEntries={[`/procedure/${id}${queryParams}`]}>
      <Routes>
        <Route path="/procedure/:id" element={<ProcedureView />} />
        <Route path="/encounter/:id" element={<div>Encounter Page</div>} />
        <Route path="/patient/:id" element={<div>Patient Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── ImmunizationView ──────────────────────────────────────────────────────────

describe("ImmunizationView", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading spinner initially", () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    renderImmunizationView();
    expect(document.querySelector("svg.MuiCircularProgress-svg")).toBeTruthy();
  });

  it("shows an error message on 404", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);
    renderImmunizationView();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it("shows an error message on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Connection refused"));
    renderImmunizationView();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("renders vaccine name and status chip", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => immunizationResource,
    } as Response);

    renderImmunizationView();

    await waitFor(() => {
      // Name appears in both the subtitle heading and the table row
      const nameEls = screen.getAllByText(
        "Influenza, seasonal, injectable, preservative free",
      );
      expect(nameEls.length).toBeGreaterThan(0);
      // Status chip
      expect(screen.getByText("completed")).toBeInTheDocument();
    });
  });

  it("renders CVX code from vaccineCode.coding", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => immunizationResource,
    } as Response);

    renderImmunizationView();

    await waitFor(() => {
      // CVX code 140 should appear somewhere
      expect(screen.getByText(/140/)).toBeInTheDocument();
    });
  });

  it("renders patient display name as a link", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => immunizationResource,
    } as Response);

    renderImmunizationView();

    await waitFor(() => {
      const patientLink = screen.getByRole("link", { name: /jane doe/i });
      expect(patientLink).toBeInTheDocument();
      expect(patientLink.getAttribute("href")).toContain(`/patient/${PAT_ID}`);
    });
  });

  it("shows 'Back to Encounter' button when encounterId query param is present", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => immunizationResource,
    } as Response);

    renderImmunizationView();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /back to encounter/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows 'Back to Patient' when no encounterId but patientId present", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ...immunizationResource, _patientId: PAT_ID }),
    } as Response);

    renderImmunizationView(IMM_ID, `?patientId=${PAT_ID}`);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /back to patient/i }),
      ).toBeInTheDocument();
    });
  });

  it("fetches the correct endpoint based on the id param", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => immunizationResource,
    } as Response);

    renderImmunizationView(IMM_ID);

    await waitFor(() => {
      const url = String(vi.mocked(fetch).mock.calls[0][0]);
      expect(url).toContain(`/fhir/Immunization/${IMM_ID}`);
    });
  });
});

// ── ProcedureView ─────────────────────────────────────────────────────────────

describe("ProcedureView", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading spinner initially", () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    renderProcedureView();
    expect(document.querySelector("svg.MuiCircularProgress-svg")).toBeTruthy();
  });

  it("shows an error message on 404", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);
    renderProcedureView();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it("renders procedure name and status chip", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => procedureResource,
    } as Response);

    renderProcedureView();

    await waitFor(() => {
      // Name appears in both the subtitle heading and the table row
      const nameEls = screen.getAllByText("Blood pressure measurement");
      expect(nameEls.length).toBeGreaterThan(0);
      expect(screen.getByText("completed")).toBeInTheDocument();
    });
  });

  it("renders SNOMED code from code.coding", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => procedureResource,
    } as Response);

    renderProcedureView();

    await waitFor(() => {
      expect(screen.getByText(/75367002/)).toBeInTheDocument();
    });
  });

  it("renders patient name as a link to the patient page", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => procedureResource,
    } as Response);

    renderProcedureView();

    await waitFor(() => {
      const patientLink = screen.getByRole("link", { name: /jane doe/i });
      expect(patientLink).toBeInTheDocument();
      expect(patientLink.getAttribute("href")).toContain(`/patient/${PAT_ID}`);
    });
  });

  it("renders reason code as a chip", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => procedureResource,
    } as Response);

    renderProcedureView();

    await waitFor(() => {
      expect(screen.getByText("Annual checkup")).toBeInTheDocument();
    });
  });

  it("shows 'Back to Encounter' button when encounterId query param is present", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => procedureResource,
    } as Response);

    renderProcedureView();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /back to encounter/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows 'Back to Patient' when no encounterId but patientId present", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ...procedureResource, _patientId: PAT_ID }),
    } as Response);

    renderProcedureView(PROC_ID, `?patientId=${PAT_ID}`);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /back to patient/i }),
      ).toBeInTheDocument();
    });
  });

  it("calculates and renders duration from performedPeriod", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => procedureResource,
    } as Response);

    renderProcedureView();

    await waitFor(() => {
      // 09:00 → 09:30 = 30 min
      expect(screen.getByText("30 min")).toBeInTheDocument();
    });
  });

  it("fetches the correct endpoint based on the id param", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => procedureResource,
    } as Response);

    renderProcedureView(PROC_ID);

    await waitFor(() => {
      const url = String(vi.mocked(fetch).mock.calls[0][0]);
      expect(url).toContain(`/fhir/Procedure/${PROC_ID}`);
    });
  });
});
