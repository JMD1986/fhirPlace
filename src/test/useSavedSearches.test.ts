import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSavedSearches } from "../hooks/useSavedSearches";
import type { PatientSearchParams, EncounterSearchParams } from "../hooks/hookTypes";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const patientParams: PatientSearchParams = {
  name: "Alice",
  familyName: "",
  givenName: "",
  gender: "",
  birthDate: "",
  phone: "",
  address: "",
};

const encounterParams: EncounterSearchParams = {
  patient: "pat-001",
  status: "finished",
  classCode: "",
  type: "",
  dateFrom: "",
  dateTo: "",
  reason: "",
};

const TEST_EMAIL = "user@test.com";

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
});

// ── Initial state ─────────────────────────────────────────────────────────────

describe("useSavedSearches — initial state", () => {
  it("returns an empty searches array when localStorage is empty", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );
    expect(result.current.searches).toHaveLength(0);
  });

  it("exposes MAX_SAVED as a number", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );
    expect(result.current.MAX_SAVED).toBeGreaterThan(0);
  });
});

// ── save ──────────────────────────────────────────────────────────────────────

describe("useSavedSearches — save", () => {
  it("adds a new search to the list", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("My Search", patientParams);
    });

    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0].name).toBe("My Search");
    expect(result.current.searches[0].params).toEqual(patientParams);
    expect(result.current.searches[0].kind).toBe("patient");
  });

  it("persists saved searches to localStorage", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("Persisted Search", patientParams);
    });

    const stored = JSON.parse(
      localStorage.getItem(`fhirPlace_savedSearches_${TEST_EMAIL}`) ?? "[]",
    ) as { name: string }[];
    expect(stored.some((s) => s.name === "Persisted Search")).toBe(true);
  });

  it("replaces an existing search with the same name (case-insensitive)", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("Alice Search", patientParams);
    });
    act(() => {
      result.current.save("alice search", { ...patientParams, name: "Bob" });
    });

    expect(result.current.searches).toHaveLength(1);
    expect((result.current.searches[0].params as PatientSearchParams).name).toBe("Bob");
  });

  it("trims whitespace from the search name", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("  Trimmed  ", patientParams);
    });

    expect(result.current.searches[0].name).toBe("Trimmed");
  });

  it("enforces a maximum number of saved searches", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );
    const max = result.current.MAX_SAVED;

    act(() => {
      for (let i = 0; i < max + 2; i++) {
        result.current.save(`Search ${i}`, patientParams);
      }
    });

    expect(result.current.searches).toHaveLength(max);
  });

  it("does not mix patient and encounter searches in the same kind filter", () => {
    const { result: patResult } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );
    const { result: encResult } = renderHook(() =>
      useSavedSearches("encounter", TEST_EMAIL),
    );

    act(() => {
      patResult.current.save("Patient A", patientParams);
    });
    act(() => {
      encResult.current.save("Encounter E", encounterParams);
    });

    // Each hook should only see its own kind
    expect(patResult.current.searches.every((s) => s.kind === "patient")).toBe(true);
    expect(encResult.current.searches.every((s) => s.kind === "encounter")).toBe(true);
  });

  it("generates a unique id for each new entry", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("First", patientParams);
    });
    act(() => {
      result.current.save("Second", patientParams);
    });

    const ids = result.current.searches.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });
});

// ── remove ────────────────────────────────────────────────────────────────────

describe("useSavedSearches — remove", () => {
  it("removes a search by id", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("To Remove", patientParams);
    });
    const id = result.current.searches[0].id;

    act(() => {
      result.current.remove(id);
    });

    expect(result.current.searches).toHaveLength(0);
  });

  it("does not affect other searches when one is removed", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("Keep", patientParams);
    });
    act(() => {
      result.current.save("Remove Me", patientParams);
    });

    const removeId = result.current.searches.find(
      (s) => s.name === "Remove Me",
    )!.id;

    act(() => {
      result.current.remove(removeId);
    });

    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0].name).toBe("Keep");
  });

  it("updates localStorage after removal", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("Del Search", patientParams);
    });
    const id = result.current.searches[0].id;

    act(() => {
      result.current.remove(id);
    });

    const stored = JSON.parse(
      localStorage.getItem(`fhirPlace_savedSearches_${TEST_EMAIL}`) ?? "[]",
    ) as { name: string }[];
    expect(stored.some((s) => s.name === "Del Search")).toBe(false);
  });

  it("is a no-op when the given id does not exist", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("Safe", patientParams);
    });

    act(() => {
      result.current.remove("non-existent-id");
    });

    expect(result.current.searches).toHaveLength(1);
  });
});

// ── rename ────────────────────────────────────────────────────────────────────

describe("useSavedSearches — rename", () => {
  it("renames a search by id", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("Old Name", patientParams);
    });
    const id = result.current.searches[0].id;

    act(() => {
      result.current.rename(id, "New Name");
    });

    expect(result.current.searches[0].name).toBe("New Name");
  });

  it("trims whitespace from the new name", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("Original", patientParams);
    });
    const id = result.current.searches[0].id;

    act(() => {
      result.current.rename(id, "  Trimmed New  ");
    });

    expect(result.current.searches[0].name).toBe("Trimmed New");
  });

  it("updates localStorage after renaming", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", TEST_EMAIL),
    );

    act(() => {
      result.current.save("Before Rename", patientParams);
    });
    const id = result.current.searches[0].id;

    act(() => {
      result.current.rename(id, "After Rename");
    });

    const stored = JSON.parse(
      localStorage.getItem(`fhirPlace_savedSearches_${TEST_EMAIL}`) ?? "[]",
    ) as { name: string }[];
    expect(stored.some((s) => s.name === "After Rename")).toBe(true);
    expect(stored.some((s) => s.name === "Before Rename")).toBe(false);
  });
});

// ── localStorage scoping ──────────────────────────────────────────────────────

describe("useSavedSearches — localStorage scoping", () => {
  it("uses the user email as part of the storage key", () => {
    const { result } = renderHook(() =>
      useSavedSearches("patient", "alice@example.com"),
    );

    act(() => {
      result.current.save("Scoped Search", patientParams);
    });

    expect(
      localStorage.getItem("fhirPlace_savedSearches_alice@example.com"),
    ).not.toBeNull();
    expect(localStorage.getItem("fhirPlace_savedSearches")).toBeNull();
  });

  it("uses a generic key when no user email is provided", () => {
    const { result } = renderHook(() => useSavedSearches("patient"));

    act(() => {
      result.current.save("Anonymous Search", patientParams);
    });

    expect(localStorage.getItem("fhirPlace_savedSearches")).not.toBeNull();
  });

  it("loads existing searches from localStorage on mount", () => {
    // Pre-populate localStorage
    const email = "preload@example.com";
    const key = `fhirPlace_savedSearches_${email}`;
    const pre = [
      {
        id: "pre-id-1",
        name: "Pre-loaded",
        kind: "patient",
        params: patientParams,
        createdAt: new Date().toISOString(),
      },
    ];
    localStorage.setItem(key, JSON.stringify(pre));

    const { result } = renderHook(() => useSavedSearches("patient", email));

    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0].name).toBe("Pre-loaded");
  });

  it("handles corrupted localStorage gracefully by returning empty", () => {
    localStorage.setItem("fhirPlace_savedSearches_bad@example.com", "NOT_JSON");
    const { result } = renderHook(() =>
      useSavedSearches("patient", "bad@example.com"),
    );
    expect(result.current.searches).toHaveLength(0);
  });
});
