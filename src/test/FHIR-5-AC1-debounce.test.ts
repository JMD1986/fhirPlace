/**
 * FHIR-5  AC1 — NLM API debounce
 *
 * The NLM API must not be called more than once during a 300 ms burst of
 * typing.  The hook that owns the NLM fetch (useNLMClinicalTables) must
 * debounce its input string by 300 ms before issuing a network request.
 *
 * These tests call the hook directly via renderHook so they are isolated
 * from any component markup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { useNLMCondition, useNLMLoinc } from "../hooks/useNLMClinicalTables";

// ── fake fetch ────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.fetch = mockFetch;
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => [1, ["id1"], null, [["Hypertension", "http://url,Label", "I10"]]],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe("useNLMCondition — 300 ms debounce (FHIR-5 AC1)", () => {
  it("does NOT call fetch while typing within the 300 ms window", async () => {
    const { rerender } = renderHook(
      ({ name }: { name?: string }) => useNLMCondition(name),
      { initialProps: { name: undefined } },
    );

    // Simulate rapid keystrokes — each < 300 ms apart, effect flushes between each
    await act(async () => { rerender({ name: "H" }); });
    await act(async () => { vi.advanceTimersByTime(100); });
    await act(async () => { rerender({ name: "Hy" }); });
    await act(async () => { vi.advanceTimersByTime(100); });
    await act(async () => { rerender({ name: "Hyp" }); });
    await act(async () => { vi.advanceTimersByTime(100); });
    await act(async () => { rerender({ name: "Hype" }); });
    await act(async () => { vi.advanceTimersByTime(100); });
    // Last timer has only run 100ms of its 300ms — should not have fired

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls fetch exactly once after the input settles for 300 ms", async () => {
    const { rerender } = renderHook(
      ({ name }: { name?: string }) => useNLMCondition(name),
      { initialProps: { name: undefined } },
    );

    await act(async () => { rerender({ name: "Hypertension" }); });
    await act(async () => { vi.advanceTimersByTime(300); });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("conditions");
  });

  it("calls fetch once per settled value, not for every intermediate keystroke", async () => {
    const { rerender } = renderHook(
      ({ name }: { name?: string }) => useNLMCondition(name),
      { initialProps: { name: undefined } },
    );

    // First burst — effects flush between each keystroke via individual acts
    await act(async () => { rerender({ name: "Dia" }); });
    await act(async () => { vi.advanceTimersByTime(100); });
    await act(async () => { rerender({ name: "Diab" }); });
    await act(async () => { vi.advanceTimersByTime(100); });
    await act(async () => { rerender({ name: "Diabe" }); });
    // Settle — timer for "Diabe" fires
    await act(async () => { vi.advanceTimersByTime(300); });

    // Second burst
    await act(async () => { rerender({ name: "Hyperten" }); });
    await act(async () => { vi.advanceTimersByTime(100); });
    await act(async () => { rerender({ name: "Hypertension" }); });
    // Settle — timer for "Hypertension" fires
    await act(async () => { vi.advanceTimersByTime(300); });

    // Two settled values → exactly two API calls
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("cancels the pending debounce when the component unmounts", async () => {
    const { rerender, unmount } = renderHook(
      ({ name }: { name?: string }) => useNLMCondition(name),
      { initialProps: { name: undefined } },
    );

    await act(async () => { rerender({ name: "Diabetes" }); });
    await act(async () => { vi.advanceTimersByTime(150); }); // debounce still pending…
    await act(async () => { unmount(); });                   // …then component is removed
    await act(async () => { vi.advanceTimersByTime(300); }); // timer fires after unmount

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("useNLMLoinc — 300 ms debounce (FHIR-5 AC1)", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        1,
        ["8867-4"],
        null,
        [["8867-4", "Heart rate", "Heart rate", "/min", "", "", "Order", "VITALS"]],
      ],
    });
  });

  it("does NOT call fetch during a rapid typing burst", async () => {
    const { rerender } = renderHook(
      ({ code }: { code?: string }) => useNLMLoinc(code),
      { initialProps: { code: undefined } },
    );

    await act(async () => { rerender({ code: "8" }); });
    await act(async () => { vi.advanceTimersByTime(100); });
    await act(async () => { rerender({ code: "88" }); });
    await act(async () => { vi.advanceTimersByTime(100); });
    await act(async () => { rerender({ code: "886" }); });
    await act(async () => { vi.advanceTimersByTime(100); });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls fetch exactly once after the code settles for 300 ms", async () => {
    const { rerender } = renderHook(
      ({ code }: { code?: string }) => useNLMLoinc(code),
      { initialProps: { code: undefined } },
    );

    await act(async () => { rerender({ code: "8867-4" }); });
    await act(async () => { vi.advanceTimersByTime(300); });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("loinc");
  });
});
