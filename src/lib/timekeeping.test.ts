import { describe, it, expect } from "vitest";
import {
  auditFilterRangeToUtc,
  formatAuditDateTime,
  clientMetadataNowIso,
} from "./timekeeping";

describe("auditFilterRangeToUtc", () => {
  it("returns UTC start-of-day and end-of-day bounds", () => {
    expect(auditFilterRangeToUtc("2024-01-15", "2024-01-20")).toEqual({
      startDate: "2024-01-15T00:00:00.000Z",
      endDate: "2024-01-20T23:59:59.999Z",
    });
  });

  it("returns only start when end is empty", () => {
    expect(auditFilterRangeToUtc("2024-06-01", "")).toEqual({
      startDate: "2024-06-01T00:00:00.000Z",
    });
  });

  it("returns only end when start is empty", () => {
    expect(auditFilterRangeToUtc("", "2024-06-30")).toEqual({
      endDate: "2024-06-30T23:59:59.999Z",
    });
  });

  it("returns empty object when both dates are empty", () => {
    expect(auditFilterRangeToUtc("", "")).toEqual({});
  });
});

describe("formatAuditDateTime", () => {
  it("formats a valid ISO string with month name", () => {
    const formatted = formatAuditDateTime("2024-01-15T15:45:00.000Z");
    expect(formatted).toMatch(/Jan/);
    expect(formatted).toMatch(/15/);
    expect(formatted).toMatch(/2024/);
  });

  it("returns the input when parsing fails", () => {
    expect(formatAuditDateTime("not-a-date")).toBe("not-a-date");
  });
});

describe("clientMetadataNowIso", () => {
  it("returns a parseable ISO 8601 string", () => {
    const iso = clientMetadataNowIso();
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
