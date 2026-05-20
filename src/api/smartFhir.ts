/**
 * Routes FHIR reads through the active SMART fhirclient session (Epic, SMART Health IT, etc.).
 * Local Synthea data uses fhirApi → ASP.NET when no SMART client is registered.
 */

import type Client from "fhirclient/lib/Client";
import type { FhirBundle } from "../types/fhir";
import { logAuditEvent } from "./auditApi";

let _client: Client | null = null;

export function setSmartFhirClient(client: Client | null): void {
  _client = client;
}

export function getSmartFhirClient(): Client | null {
  return _client;
}

/** True when FHIR search/read should use the EHR bearer token instead of the local API. */
export function isEhrFhirMode(): boolean {
  return _client != null;
}

/** Map HAPI-style `_getpagesoffset` (local server) to `_offset` for remote FHIR servers. */
export function normalizeEhrSearchParams(
  params: URLSearchParams,
): URLSearchParams {
  const normalized = new URLSearchParams(params);
  const legacyOffset = normalized.get("_getpagesoffset");
  if (legacyOffset != null) {
    normalized.delete("_getpagesoffset");
    if (!normalized.has("_offset")) {
      normalized.set("_offset", legacyOffset);
    }
  }
  return normalized;
}

function resourceTypeFromPath(path: string): string | undefined {
  const segment = path.split(/[/?]/)[0];
  return segment || undefined;
}

async function logEhrFhirAccess(path: string): Promise<void> {
  const resourceType = resourceTypeFromPath(path);
  const isSearch = path.includes("?");
  await logAuditEvent({
    action: isSearch ? "search" : "read",
    resourceType,
    requestPath: path,
    detail: "FHIR request via SMART session (EHR)",
  }).catch(() => {});
}

export async function ehrFhirSearch<T>(
  resourceType: string,
  params: URLSearchParams,
): Promise<FhirBundle<T>> {
  if (!_client) {
    throw new Error("No SMART FHIR client — sign in with SMART first");
  }
  const normalized = normalizeEhrSearchParams(params);
  const query = normalized.toString();
  const path = query ? `${resourceType}?${query}` : resourceType;
  await logEhrFhirAccess(path);
  return _client.request<FhirBundle<T>>(path);
}

export async function ehrFhirGet<T>(
  resourceType: string,
  id: string,
): Promise<T> {
  if (!_client) {
    throw new Error("No SMART FHIR client — sign in with SMART first");
  }
  const path = `${resourceType}/${id}`;
  await logEhrFhirAccess(path);
  return _client.request<T>(path);
}
