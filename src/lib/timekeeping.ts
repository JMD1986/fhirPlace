/**
 * HL7-aligned timekeeping for fhirPlace (client layer).
 * See docs/timekeeping-design-system.md.
 */

/** Monotonic milliseconds — immune to wall-clock adjustments. */
export function monotonicNow(): number {
  return performance.now();
}

/** Display-only client metadata timestamps (saved searches, profile). */
export function clientMetadataNowIso(): string {
  return new Date().toISOString();
}

const CLINICAL_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/** Audit log table — explicit Intl options (month name, not ambiguous numeric dates). */
export function formatAuditDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, CLINICAL_DATETIME_OPTIONS);
  } catch {
    return iso;
  }
}

export interface AuditFilterUtcRange {
  startDate?: string;
  endDate?: string;
}

/**
 * Convert HTML date input values (YYYY-MM-DD) to UTC ISO bounds for audit API queries.
 * Uses explicit UTC midnight / end-of-day — not local `Date` parsing of bare dates.
 */
export function auditFilterRangeToUtc(
  startDate: string,
  endDate: string,
): AuditFilterUtcRange {
  const result: AuditFilterUtcRange = {};
  if (startDate) {
    result.startDate = `${startDate}T00:00:00.000Z`;
  }
  if (endDate) {
    result.endDate = `${endDate}T23:59:59.999Z`;
  }
  return result;
}
