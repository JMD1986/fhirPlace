/**
 * ONC §170.315(d)(2) — Audit Log API client.
 * Provides methods to query, log, and verify audit events.
 */

import { API_BASE } from "./fhirApi";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditEventRecord {
  id: number;
  timestamp: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  patientId: string | null;
  userId: string;
  userName: string;
  userRole: string;
  httpMethod: string;
  requestPath: string;
  queryString: string | null;
  statusCode: number;
  clientIp: string | null;
  outcome: string;
  detail: string | null;
  integrityHash: string;
}

export interface AuditQueryResponse {
  total: number;
  offset: number;
  count: number;
  events: AuditEventRecord[];
}

export interface AuditVerifyResponse {
  integrityValid: boolean;
  chainLength: number;
  brokenAtId: number | null;
  verifiedAt: string;
}

export interface AuditStatsResponse {
  total: number;
  failures: number;
  byAction: { action: string; count: number }[];
  byResourceType: { resourceType: string; count: number }[];
  byUser: { userId: string; count: number }[];
}

export interface AuditQueryParams {
  userId?: string;
  patientId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  outcome?: string;
  _count?: number;
  _offset?: number;
}

// ── Module-level user for audit headers ───────────────────────────────────────
let _auditHeaders: Record<string, string> = {};

export function setAuditHeaders(
  user: {
    userId: string;
    userName: string;
    userRole: string;
    linkedPatientId?: string;
  } | null,
): void {
  if (user) {
    _auditHeaders = {
      "X-Audit-User-Id": user.userId,
      "X-Audit-User-Name": user.userName,
      "X-Audit-User-Role": user.userRole,
    };
    if (user.linkedPatientId) {
      _auditHeaders["X-Audit-Patient-Context"] = user.linkedPatientId;
    }
  } else {
    _auditHeaders = {};
  }
}

async function auditFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...init?.headers, ..._auditHeaders },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText || "Error"}`);
  }
  return res.json() as Promise<T>;
}

// ── API Methods ───────────────────────────────────────────────────────────────

/** Query audit events with filtering and pagination. */
export function queryAuditEvents(
  params: AuditQueryParams = {},
): Promise<AuditQueryResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return auditFetch(`/api/audit?${qs.toString()}`);
}

/** Log a frontend-initiated event (login, logout, etc.). */
export function logAuditEvent(event: {
  action: string;
  resourceType?: string;
  resourceId?: string;
  patientId?: string;
  requestPath?: string;
  detail?: string;
}): Promise<{ status: string; id: number }> {
  return auditFetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
}

/** Verify the integrity of the audit chain (tamper detection). */
export function verifyAuditChain(): Promise<AuditVerifyResponse> {
  return auditFetch("/api/audit/verify");
}

/** Get audit log statistics. */
export function getAuditStats(): Promise<AuditStatsResponse> {
  return auditFetch("/api/audit/stats");
}
