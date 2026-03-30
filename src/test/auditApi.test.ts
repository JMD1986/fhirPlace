import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setAuditHeaders,
  queryAuditEvents,
  logAuditEvent,
  verifyAuditChain,
  getAuditStats,
} from "../api/auditApi";

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
  setAuditHeaders(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── queryAuditEvents ──────────────────────────────────────────────────────────

describe("queryAuditEvents", () => {
  it("fetches GET /api/audit with no params", async () => {
    const response = { total: 0, offset: 0, count: 0, events: [] };
    vi.mocked(fetch).mockResolvedValue(okResponse(response) as Response);

    const result = await queryAuditEvents();

    expect(result).toEqual(response);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/api/audit");
  });

  it("appends query params to the URL", async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ total: 0, offset: 0, count: 0, events: [] }) as Response,
    );

    await queryAuditEvents({ userId: "u1", action: "read", _count: 10 });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("userId=u1");
    expect(url).toContain("action=read");
    expect(url).toContain("_count=10");
  });

  it("omits undefined/empty params from the query string", async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ total: 0, offset: 0, count: 0, events: [] }) as Response,
    );

    await queryAuditEvents({ userId: undefined, action: "" });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).not.toContain("userId");
    expect(url).not.toContain("action");
  });

  it("throws on a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(500, "Internal Server Error") as Response);

    await expect(queryAuditEvents()).rejects.toThrow("HTTP 500");
  });
});

// ── logAuditEvent ─────────────────────────────────────────────────────────────

describe("logAuditEvent", () => {
  it("POSTs to /api/audit with the event payload", async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ status: "ok", id: 42 }) as Response,
    );

    const result = await logAuditEvent({
      action: "login",
      resourceType: "Patient",
      resourceId: "p1",
    });

    expect(result).toEqual({ status: "ok", id: 42 });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/audit");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ action: "login" });
  });

  it("sends Content-Type: application/json", async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ status: "ok", id: 1 }) as Response,
    );

    await logAuditEvent({ action: "logout" });

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("throws on a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(400, "Bad Request") as Response);

    await expect(logAuditEvent({ action: "login" })).rejects.toThrow("HTTP 400");
  });
});

// ── verifyAuditChain ──────────────────────────────────────────────────────────

describe("verifyAuditChain", () => {
  it("calls GET /api/audit/verify and returns the response", async () => {
    const verifyResponse = {
      integrityValid: true,
      chainLength: 100,
      brokenAtId: null,
      verifiedAt: "2024-01-01T00:00:00Z",
    };
    vi.mocked(fetch).mockResolvedValue(okResponse(verifyResponse) as Response);

    const result = await verifyAuditChain();

    expect(result).toEqual(verifyResponse);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/api/audit/verify");
  });

  it("throws when integrity check returns a non-2xx status", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(503, "Service Unavailable") as Response);

    await expect(verifyAuditChain()).rejects.toThrow("HTTP 503");
  });
});

// ── getAuditStats ─────────────────────────────────────────────────────────────

describe("getAuditStats", () => {
  it("calls GET /api/audit/stats and returns the response", async () => {
    const statsResponse = {
      total: 250,
      failures: 5,
      byAction: [{ action: "read", count: 200 }],
      byResourceType: [{ resourceType: "Patient", count: 150 }],
      byUser: [{ userId: "u1", count: 100 }],
    };
    vi.mocked(fetch).mockResolvedValue(okResponse(statsResponse) as Response);

    const result = await getAuditStats();

    expect(result).toEqual(statsResponse);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit?];
    expect(url).toContain("/api/audit/stats");
  });
});

// ── setAuditHeaders ───────────────────────────────────────────────────────────

describe("setAuditHeaders", () => {
  it("injects X-Audit-User-* headers into subsequent requests", async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ total: 0, offset: 0, count: 0, events: [] }) as Response,
    );

    setAuditHeaders({ userId: "u2", userName: "Bob", userRole: "admin" });
    await queryAuditEvents();

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Audit-User-Id"]).toBe("u2");
    expect(headers["X-Audit-User-Name"]).toBe("Bob");
    expect(headers["X-Audit-User-Role"]).toBe("admin");
  });

  it("clears audit headers when called with null", async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ total: 0, offset: 0, count: 0, events: [] }) as Response,
    );

    setAuditHeaders({ userId: "u3", userName: "Carol", userRole: "viewer" });
    setAuditHeaders(null);
    await queryAuditEvents();

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Audit-User-Id"]).toBeUndefined();
  });
});
