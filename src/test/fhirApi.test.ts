import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock auditApi before importing fhirApi ────────────────────────────────────

vi.mock("../api/auditApi", () => ({
  logAuditEvent: vi.fn().mockResolvedValue({ status: "ok", id: 1 }),
}));

import {
  patientApi,
  encounterApi,
  fhirSearch,
  fhirGet,
  setAuditUser,
  downloadCcd,
  prefetchPatient,
  API_BASE,
} from "../api/fhirApi";
import { logAuditEvent } from "../api/auditApi";

// ── Helpers ───────────────────────────────────────────────────────────────────

const okResponse = <T>(data: T) => ({
  ok: true,
  json: () => Promise.resolve(data),
});

const errorResponse = (status: number, statusText = "") => ({
  ok: false,
  status,
  statusText,
});

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  setAuditUser(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── API_BASE ──────────────────────────────────────────────────────────────────

describe("API_BASE", () => {
  it("defaults to http://localhost:5001 when VITE_API_BASE is unset", () => {
    expect(API_BASE).toBe("http://localhost:5001");
  });
});

// ── apiFetch — success path ───────────────────────────────────────────────────

describe("patientApi.search", () => {
  it("calls the correct FHIR endpoint with query params", async () => {
    const bundle = { resourceType: "Bundle", entry: [] };
    vi.mocked(fetch).mockResolvedValue(okResponse(bundle) as Response);

    const params = new URLSearchParams({ name: "Alice" });
    await patientApi.search(params);

    expect(fetch).toHaveBeenCalledOnce();
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/fhir/Patient?name=Alice");
  });

  it("returns the parsed JSON body on success", async () => {
    const bundle = { resourceType: "Bundle", total: 1, entry: [] };
    vi.mocked(fetch).mockResolvedValue(okResponse(bundle) as Response);

    const result = await patientApi.search(new URLSearchParams());
    expect(result).toEqual(bundle);
  });
});

// ── apiFetch — error path ─────────────────────────────────────────────────────

describe("apiFetch error handling", () => {
  it("throws an Error on 404 responses", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(404, "Not Found") as Response);

    await expect(patientApi.search(new URLSearchParams())).rejects.toThrow(
      "HTTP 404",
    );
  });

  it("throws an Error on 500 responses", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(500) as Response);

    await expect(patientApi.search(new URLSearchParams())).rejects.toThrow(
      "HTTP 500",
    );
  });

  it("uses the status text mapping when statusText is empty", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(403, "") as Response);

    await expect(patientApi.search(new URLSearchParams())).rejects.toThrow(
      "Forbidden",
    );
  });
});

// ── Audit headers ─────────────────────────────────────────────────────────────

describe("audit headers via setAuditUser", () => {
  it("adds X-Audit-User-* headers when audit user is set", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse({ resourceType: "Bundle", entry: [] }) as Response);

    setAuditUser({ userId: "u1", userName: "Alice", userRole: "clinician" });
    await patientApi.search(new URLSearchParams());

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    const headers = init?.headers as Headers;
    expect(headers.get("X-Audit-User-Id")).toBe("u1");
    expect(headers.get("X-Audit-User-Name")).toBe("Alice");
    expect(headers.get("X-Audit-User-Role")).toBe("clinician");
  });

  it("omits audit headers when no audit user is set", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse({ resourceType: "Bundle", entry: [] }) as Response);

    await patientApi.search(new URLSearchParams());

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    const headers = init?.headers as Headers;
    expect(headers.get("X-Audit-User-Id")).toBeNull();
  });
});

// ── patientApi.getById ────────────────────────────────────────────────────────

describe("patientApi.getById", () => {
  it("fetches a patient by ID from the correct endpoint", async () => {
    const patient = { resourceType: "Patient", id: "fresh-001" };
    vi.mocked(fetch).mockResolvedValue(okResponse(patient) as Response);

    const result = await patientApi.getById("fresh-001");
    expect(result).toEqual(patient);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/fhir/Patient/fresh-001");
  });

  it("returns the cached result on a second call with the same ID", async () => {
    const patient = { resourceType: "Patient", id: "cached-001" };
    vi.mocked(fetch).mockResolvedValue(okResponse(patient) as Response);

    await patientApi.getById("cached-001");
    await patientApi.getById("cached-001");

    // fetch should only be called once due to cache
    expect(fetch).toHaveBeenCalledOnce();
  });
});

// ── encounterApi ──────────────────────────────────────────────────────────────

describe("encounterApi.search", () => {
  it("calls /fhir/Encounter with provided params", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse({ resourceType: "Bundle", entry: [] }) as Response);

    await encounterApi.search(new URLSearchParams({ patient: "pat-1" }));

    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/fhir/Encounter?patient=pat-1");
  });
});

describe("encounterApi.getById", () => {
  it("calls /fhir/Encounter/:id", async () => {
    const enc = { resourceType: "Encounter", id: "enc-1" };
    vi.mocked(fetch).mockResolvedValue(okResponse(enc) as Response);

    await encounterApi.getById("enc-1");

    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/fhir/Encounter/enc-1");
  });
});

describe("encounterApi.getTypes", () => {
  it("calls /fhir/Encounter/_types", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse(["AMB", "IMP"]) as Response);

    const types = await encounterApi.getTypes();
    expect(types).toEqual(["AMB", "IMP"]);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/fhir/Encounter/_types");
  });
});

describe("encounterApi.getClasses", () => {
  it("calls /fhir/Encounter/_classes", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse(["AMB"]) as Response);

    await encounterApi.getClasses();

    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/fhir/Encounter/_classes");
  });
});

// ── fhirSearch ────────────────────────────────────────────────────────────────

describe("fhirSearch", () => {
  it("constructs the correct URL for a given resource type", async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse({ resourceType: "Bundle", entry: [] }) as Response);

    await fhirSearch("Condition", new URLSearchParams({ patient: "p1" }));

    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/fhir/Condition?patient=p1");
  });
});

// ── fhirGet ───────────────────────────────────────────────────────────────────

describe("fhirGet", () => {
  it("constructs the correct URL for resource type and ID", async () => {
    const condition = { resourceType: "Condition", id: "cond-1" };
    vi.mocked(fetch).mockResolvedValue(okResponse(condition) as Response);

    const result = await fhirGet("Condition", "cond-1");
    expect(result).toEqual(condition);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/fhir/Condition/cond-1");
  });
});

// ── downloadCcd ───────────────────────────────────────────────────────────────

describe("downloadCcd", () => {
  it("creates and clicks an anchor element for the CCD export", () => {
    const anchor = {
      href: "",
      download: "",
      click: vi.fn(),
      remove: vi.fn(),
    };
    vi.spyOn(document, "createElement").mockReturnValue(anchor as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, "appendChild").mockImplementation(() => anchor as unknown as HTMLAnchorElement);

    downloadCcd("pat-ccd-001");

    expect(anchor.href).toContain("pat-ccd-001");
    expect(anchor.download).toContain("CCD_pat-ccd-001");
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
  });

  it("logs an audit disclosure event", () => {
    const anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    vi.spyOn(document, "createElement").mockReturnValue(anchor as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, "appendChild").mockImplementation(() => anchor as unknown as HTMLAnchorElement);

    downloadCcd("pat-audit-001");

    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "disclosure",
        resourceType: "Patient",
        patientId: "pat-audit-001",
      }),
    );
  });
});

// ── prefetchPatient ───────────────────────────────────────────────────────────

describe("prefetchPatient", () => {
  it("fires a background fetch for a patient not yet in the cache", () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ resourceType: "Patient", id: "prefetch-001" }) as Response,
    );

    prefetchPatient("prefetch-001");

    // fetch is triggered asynchronously; at least confirm it was called
    expect(fetch).toHaveBeenCalled();
  });

  it("does not call fetch when the patient is already cached", async () => {
    // Warm the cache first
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ resourceType: "Patient", id: "prefetch-002" }) as Response,
    );
    await patientApi.getById("prefetch-002");
    vi.mocked(fetch).mockClear();

    prefetchPatient("prefetch-002");

    expect(fetch).not.toHaveBeenCalled();
  });
});
