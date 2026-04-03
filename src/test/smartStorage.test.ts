import { describe, it, expect, beforeEach } from "vitest";
import { scrubFhirClientState } from "../lib/smartStorage";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SMART_KEY = "SMART_KEY";

beforeEach(() => {
  sessionStorage.clear();
});

// ── scrubFhirClientState ──────────────────────────────────────────────────────

describe("scrubFhirClientState", () => {
  it("removes the SMART_KEY entry", () => {
    sessionStorage.setItem(SMART_KEY, "some-uuid");
    scrubFhirClientState();
    expect(sessionStorage.getItem(SMART_KEY)).toBeNull();
  });

  it("removes the state blob referenced by SMART_KEY", () => {
    const stateKey = "abc-123-uuid";
    sessionStorage.setItem(SMART_KEY, stateKey);
    sessionStorage.setItem(stateKey, JSON.stringify({ tokenResponse: { access_token: "tok" } }));

    scrubFhirClientState();

    expect(sessionStorage.getItem(stateKey)).toBeNull();
    expect(sessionStorage.getItem(SMART_KEY)).toBeNull();
  });

  it("does not throw when SMART_KEY is absent", () => {
    expect(() => scrubFhirClientState()).not.toThrow();
  });

  it("does not affect unrelated sessionStorage entries", () => {
    sessionStorage.setItem("other-key", "other-value");
    sessionStorage.setItem(SMART_KEY, "uuid-x");
    sessionStorage.setItem("uuid-x", "{}");

    scrubFhirClientState();

    expect(sessionStorage.getItem("other-key")).toBe("other-value");
  });

  it("is idempotent — safe to call multiple times", () => {
    sessionStorage.setItem(SMART_KEY, "uuid-y");
    sessionStorage.setItem("uuid-y", "{}");

    scrubFhirClientState();
    expect(() => scrubFhirClientState()).not.toThrow();
    expect(sessionStorage.getItem(SMART_KEY)).toBeNull();
  });

  it("removes state blob even when storage is otherwise empty", () => {
    const stateKey = "lone-uuid";
    sessionStorage.setItem(SMART_KEY, stateKey);
    sessionStorage.setItem(stateKey, "{}");

    scrubFhirClientState();

    expect(sessionStorage.length).toBe(0);
  });
});
