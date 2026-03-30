import { describe, it, expect } from "vitest";
import {
  fmtUSD,
  shortMonth,
  fmtDateTime,
  fmtCurrency,
  formatDuration,
} from "../helpers/formatUtils";

// ── fmtUSD ────────────────────────────────────────────────────────────────────

describe("fmtUSD", () => {
  it("formats a whole number as USD with no decimal places", () => {
    expect(fmtUSD(1234)).toBe("$1,234");
  });

  it("formats zero as $0", () => {
    expect(fmtUSD(0)).toBe("$0");
  });

  it("rounds up to the nearest dollar", () => {
    expect(fmtUSD(99.99)).toBe("$100");
  });

  it("rounds down when cents are less than 0.50", () => {
    expect(fmtUSD(99.49)).toBe("$99");
  });

  it("formats negative values with a minus sign", () => {
    expect(fmtUSD(-500)).toBe("-$500");
  });

  it("formats large numbers with comma separators", () => {
    expect(fmtUSD(1_000_000)).toBe("$1,000,000");
  });
});

// ── shortMonth ────────────────────────────────────────────────────────────────

describe("shortMonth", () => {
  it("returns a locale-formatted string for a given ISO date", () => {
    const iso = "2024-01-15";
    const expected = new Date(iso).toLocaleDateString(undefined, {
      year: "2-digit",
      month: "short",
    });
    expect(shortMonth(iso)).toBe(expected);
  });

  it("works correctly for mid-year dates", () => {
    const iso = "2023-07-04";
    const expected = new Date(iso).toLocaleDateString(undefined, {
      year: "2-digit",
      month: "short",
    });
    expect(shortMonth(iso)).toBe(expected);
  });

  it("works correctly for December", () => {
    const iso = "2022-12-25";
    const expected = new Date(iso).toLocaleDateString(undefined, {
      year: "2-digit",
      month: "short",
    });
    expect(shortMonth(iso)).toBe(expected);
  });
});

// ── fmtDateTime ───────────────────────────────────────────────────────────────

describe("fmtDateTime", () => {
  it("returns an em dash for undefined input", () => {
    expect(fmtDateTime(undefined)).toBe("—");
  });

  it("formats an ISO date/time string to a localized display string", () => {
    const iso = "2024-03-15T09:30:00";
    const expected = new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(fmtDateTime(iso)).toBe(expected);
  });

  it("handles a full UTC ISO timestamp", () => {
    const iso = "2024-06-15T14:00:00Z";
    const result = fmtDateTime(iso);
    expect(result).toBeTruthy();
    expect(result).not.toBe("—");
  });

  it("returns a non-empty string for any valid ISO string", () => {
    expect(fmtDateTime("2020-01-01T00:00:00")).not.toBe("");
  });
});

// ── fmtCurrency ───────────────────────────────────────────────────────────────

describe("fmtCurrency", () => {
  it("returns an em dash when value is undefined", () => {
    expect(fmtCurrency(undefined)).toBe("—");
  });

  it("formats a value with the default USD currency code", () => {
    expect(fmtCurrency(1234.56)).toBe("USD 1234.56");
  });

  it("formats a value with a specified currency code", () => {
    expect(fmtCurrency(100, "EUR")).toBe("EUR 100.00");
  });

  it("formats zero as '0.00'", () => {
    expect(fmtCurrency(0)).toBe("USD 0.00");
  });

  it("pads to two decimal places", () => {
    expect(fmtCurrency(9.9)).toBe("USD 9.90");
  });

  it("handles large values correctly", () => {
    expect(fmtCurrency(99999.99, "GBP")).toBe("GBP 99999.99");
  });
});

// ── formatDuration ────────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("returns em dash when start is undefined", () => {
    expect(formatDuration(undefined, "2024-01-01T10:00:00Z")).toBe("—");
  });

  it("returns em dash when end is undefined", () => {
    expect(formatDuration("2024-01-01T09:00:00Z", undefined)).toBe("—");
  });

  it("returns em dash when both parameters are omitted", () => {
    expect(formatDuration()).toBe("—");
  });

  it("formats a 30-minute duration", () => {
    expect(
      formatDuration("2024-01-01T09:00:00Z", "2024-01-01T09:30:00Z"),
    ).toBe("30 min");
  });

  it("formats a 1-minute duration", () => {
    expect(
      formatDuration("2024-01-01T09:00:00Z", "2024-01-01T09:01:00Z"),
    ).toBe("1 min");
  });

  it("formats exactly one hour without minutes", () => {
    expect(
      formatDuration("2024-01-01T09:00:00Z", "2024-01-01T10:00:00Z"),
    ).toBe("1 hr");
  });

  it("formats hours with remaining minutes", () => {
    expect(
      formatDuration("2024-01-01T09:00:00Z", "2024-01-01T11:15:00Z"),
    ).toBe("2 hr 15 min");
  });

  it("formats a multi-hour duration with no remaining minutes", () => {
    expect(
      formatDuration("2024-01-01T09:00:00Z", "2024-01-01T12:00:00Z"),
    ).toBe("3 hr");
  });

  it("omits the minutes portion when remainder is zero", () => {
    const result = formatDuration("2024-01-01T08:00:00Z", "2024-01-01T10:00:00Z");
    expect(result).toBe("2 hr");
    expect(result).not.toContain("min");
  });
});
