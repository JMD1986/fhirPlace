import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInactivityTimeout } from "../hooks/useInactivityTimeout";

// Use small timeouts to keep tests fast.
const TIMEOUT_MS = 5000;
const WARNING_BEFORE_MS = 1000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ── Initial state ─────────────────────────────────────────────────────────────

describe("useInactivityTimeout — initial state", () => {
  it("starts with showWarning=false and secondsLeft=0", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useInactivityTimeout({ enabled: true, onTimeout, timeoutMs: TIMEOUT_MS, warningBeforeMs: WARNING_BEFORE_MS }),
    );

    expect(result.current.showWarning).toBe(false);
    expect(result.current.secondsLeft).toBe(0);
  });

  it("exposes a stayLoggedIn callback", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useInactivityTimeout({ enabled: true, onTimeout }),
    );

    expect(typeof result.current.stayLoggedIn).toBe("function");
  });
});

// ── Disabled state ────────────────────────────────────────────────────────────

describe("useInactivityTimeout — disabled", () => {
  it("does not call onTimeout when enabled=false", () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useInactivityTimeout({
        enabled: false,
        onTimeout,
        timeoutMs: TIMEOUT_MS,
        warningBeforeMs: WARNING_BEFORE_MS,
      }),
    );

    act(() => { vi.advanceTimersByTime(TIMEOUT_MS + 100); });

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("keeps showWarning=false when disabled", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useInactivityTimeout({
        enabled: false,
        onTimeout,
        timeoutMs: TIMEOUT_MS,
        warningBeforeMs: WARNING_BEFORE_MS,
      }),
    );

    act(() => { vi.advanceTimersByTime(TIMEOUT_MS + 100); });

    expect(result.current.showWarning).toBe(false);
  });
});

// ── Warning phase ─────────────────────────────────────────────────────────────

describe("useInactivityTimeout — warning phase", () => {
  it("has not yet called onTimeout when the warning window is entered", () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useInactivityTimeout({
        enabled: true,
        onTimeout,
        timeoutMs: TIMEOUT_MS,
        warningBeforeMs: WARNING_BEFORE_MS,
      }),
    );

    // Advance to the start of the warning window — timeout should NOT have fired yet
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS - WARNING_BEFORE_MS + 10); });

    expect(onTimeout).not.toHaveBeenCalled();
  });
});

// ── Timeout phase ─────────────────────────────────────────────────────────────

describe("useInactivityTimeout — timeout", () => {
  it("calls onTimeout after the full inactivity period", () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useInactivityTimeout({
        enabled: true,
        onTimeout,
        timeoutMs: TIMEOUT_MS,
        warningBeforeMs: WARNING_BEFORE_MS,
      }),
    );

    act(() => { vi.advanceTimersByTime(TIMEOUT_MS + 10); });

    expect(onTimeout).toHaveBeenCalledOnce();
  });
});

// ── stayLoggedIn ──────────────────────────────────────────────────────────────

describe("useInactivityTimeout — stayLoggedIn", () => {
  it("can be called without throwing", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useInactivityTimeout({
        enabled: true,
        onTimeout,
        timeoutMs: TIMEOUT_MS,
        warningBeforeMs: WARNING_BEFORE_MS,
      }),
    );

    expect(() => {
      act(() => { result.current.stayLoggedIn(); });
    }).not.toThrow();
  });

  it("prevents timeout from firing when called before the timeout elapses", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useInactivityTimeout({
        enabled: true,
        onTimeout,
        timeoutMs: TIMEOUT_MS,
        warningBeforeMs: WARNING_BEFORE_MS,
      }),
    );

    // Advance into the warning window
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS - WARNING_BEFORE_MS + 10); });

    // Reset the inactivity clock
    act(() => { result.current.stayLoggedIn(); });

    // The remaining time from the ORIGINAL timeout window passes — should NOT fire
    act(() => { vi.advanceTimersByTime(WARNING_BEFORE_MS); });

    expect(onTimeout).not.toHaveBeenCalled();
  });
});

// ── Monotonic clock (wall-clock skew) ─────────────────────────────────────────

describe("useInactivityTimeout — monotonic clock", () => {
  it("warning countdown ignores wall-clock jumps", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useInactivityTimeout({
        enabled: true,
        onTimeout,
        timeoutMs: TIMEOUT_MS,
        warningBeforeMs: WARNING_BEFORE_MS,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(TIMEOUT_MS - WARNING_BEFORE_MS + 10);
    });

    expect(result.current.showWarning).toBe(true);
    const secondsAtWarning = result.current.secondsLeft;
    expect(secondsAtWarning).toBeGreaterThan(0);

    let fakeWall = 1_000_000;
    const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => fakeWall);

    act(() => {
      fakeWall += 60 * 60 * 1000;
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.secondsLeft).toBeGreaterThan(0);
    expect(result.current.secondsLeft).toBeLessThanOrEqual(secondsAtWarning);

    dateSpy.mockRestore();
  });
});

// ── Cleanup ───────────────────────────────────────────────────────────────────

describe("useInactivityTimeout — cleanup on unmount", () => {
  it("does not call onTimeout after the hook is unmounted", () => {
    const onTimeout = vi.fn();
    const { unmount } = renderHook(() =>
      useInactivityTimeout({
        enabled: true,
        onTimeout,
        timeoutMs: TIMEOUT_MS,
        warningBeforeMs: WARNING_BEFORE_MS,
      }),
    );

    unmount();
    act(() => { vi.advanceTimersByTime(TIMEOUT_MS + 10); });

    expect(onTimeout).not.toHaveBeenCalled();
  });
});
