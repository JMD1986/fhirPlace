import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useFHIRResource } from "../hooks/useFHIRResource";

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Initial / idle state ──────────────────────────────────────────────────────

describe("useFHIRResource — idle (no id)", () => {
  it("starts with data=null, loading=false, error=null when id is undefined", () => {
    const fetcher = vi.fn();
    const { result } = renderHook(() =>
      useFHIRResource(undefined, fetcher),
    );

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("starts in idle state when id is an empty string", () => {
    const fetcher = vi.fn();
    const { result } = renderHook(() => useFHIRResource("", fetcher));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

// ── Loading state ─────────────────────────────────────────────────────────────

describe("useFHIRResource — loading", () => {
  it("sets loading=true immediately while the fetch is in flight", () => {
    let resolve!: (val: unknown) => void;
    const fetcher = vi.fn(
      () => new Promise((res) => { resolve = res; }),
    );

    const { result } = renderHook(() =>
      useFHIRResource("id-1", fetcher),
    );

    expect(result.current.loading).toBe(true);
    // Clean up by resolving the promise
    act(() => { resolve({ id: "id-1" }); });
  });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("useFHIRResource — success", () => {
  it("populates data and clears loading on a successful fetch", async () => {
    const resource = { resourceType: "Condition", id: "cond-1" };
    const fetcher = vi.fn().mockResolvedValue(resource);

    const { result } = renderHook(() =>
      useFHIRResource("cond-1", fetcher),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(resource);
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledWith("cond-1");
  });

  it("passes the id argument to the fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: "enc-99" });

    const { result } = renderHook(() =>
      useFHIRResource("enc-99", fetcher),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).toHaveBeenCalledWith("enc-99");
  });
});

// ── Error path ────────────────────────────────────────────────────────────────

describe("useFHIRResource — error", () => {
  it("captures the error message and clears loading on fetch failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() =>
      useFHIRResource("bad-id", fetcher),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Not found");
  });

  it("clears a previous error when fetching with a new id succeeds", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("First error"))
      .mockResolvedValueOnce({ id: "ok-id" });

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useFHIRResource(id, fetcher),
      { initialProps: { id: "bad-id" } },
    );

    await waitFor(() => expect(result.current.error).toBe("First error"));

    rerender({ id: "ok-id" });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual({ id: "ok-id" });
  });
});

// ── Stale cancellation ────────────────────────────────────────────────────────

describe("useFHIRResource — stale result cancellation", () => {
  it("ignores a stale response when the id changes before the first fetch resolves", async () => {
    let resolveFirst!: (val: unknown) => void;
    const staleData = { id: "old-id", stale: true };
    const freshData = { id: "new-id", fresh: true };

    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise((res) => { resolveFirst = res; }),
      )
      .mockResolvedValueOnce(freshData);

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useFHIRResource(id, fetcher),
      { initialProps: { id: "old-id" } },
    );

    // Switch to a new id before the first fetch resolves
    rerender({ id: "new-id" });

    // Allow the second fetch to complete
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Now resolve the stale first fetch — should be ignored
    act(() => { resolveFirst(staleData); });

    expect(result.current.data).toEqual(freshData);
    expect(result.current.data).not.toEqual(staleData);
  });
});

// ── id reset ──────────────────────────────────────────────────────────────────

describe("useFHIRResource — id cleared", () => {
  it("resets to idle state when id is changed to undefined", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: "p1" });

    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useFHIRResource(id, fetcher),
      { initialProps: { id: "p1" as string | undefined } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ id: "p1" });

    rerender({ id: undefined });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
