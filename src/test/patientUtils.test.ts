import { describe, it, expect } from "vitest";
import {
  stripNums,
  getName,
  getAddress,
  getLanguage,
  extractPatientFromBundle,
  getRace,
  getEthnicity,
  getBirthPlace,
  formatName,
  getPhone,
  formatAddress,
} from "../helpers/patientUtils";
import type { Patient, PatientResource, FhirExtension } from "../types/fhir";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const basePatient: Patient = {
  resourceType: "Patient",
  id: "pat-001",
  name: [{ given: ["John123", "A"], family: "Doe456" }],
  address: [
    {
      line: ["42 Elm St"],
      city: "Springfield",
      state: "IL",
      postalCode: "62701",
    },
  ],
  communication: [{ language: { text: "English" } }],
};

// ── stripNums ──────────────────────────────────────────────────────────────────

describe("stripNums", () => {
  it("removes digits from a string", () => {
    expect(stripNums("John123")).toBe("John");
  });

  it("leaves a string with no digits unchanged", () => {
    expect(stripNums("Alice")).toBe("Alice");
  });

  it("returns an empty string when input is all digits", () => {
    expect(stripNums("12345")).toBe("");
  });

  it("trims leading/trailing spaces left after removal", () => {
    expect(stripNums("  John  ")).toBe("John");
  });

  it("handles an empty string", () => {
    expect(stripNums("")).toBe("");
  });
});

// ── getName ───────────────────────────────────────────────────────────────────

describe("getName", () => {
  it("formats given and family names, stripping digits", () => {
    expect(getName(basePatient)).toBe("John A Doe");
  });

  it("returns just the family name when given is absent", () => {
    const p: Patient = {
      ...basePatient,
      name: [{ family: "Smith456" }],
    };
    expect(getName(p)).toBe("Smith");
  });

  it("returns just the given name when family is absent", () => {
    const p: Patient = {
      ...basePatient,
      name: [{ given: ["Alice9"] }],
    };
    expect(getName(p)).toBe("Alice");
  });

  it("falls back to patient id when name is absent", () => {
    const p: Patient = { resourceType: "Patient", id: "pat-xyz" };
    expect(getName(p)).toBe("pat-xyz");
  });

  it("falls back to patient id when name array is empty", () => {
    const p: Patient = { resourceType: "Patient", id: "pat-abc", name: [] };
    expect(getName(p)).toBe("pat-abc");
  });
});

// ── getAddress ────────────────────────────────────────────────────────────────

describe("getAddress", () => {
  it("returns a formatted address string", () => {
    expect(getAddress(basePatient)).toBe("42 Elm St, Springfield, IL, 62701");
  });

  it("returns em dash when address is absent", () => {
    const p: Patient = { ...basePatient, address: undefined };
    expect(getAddress(p)).toBe("—");
  });

  it("returns em dash when address array is empty", () => {
    const p: Patient = { ...basePatient, address: [] };
    expect(getAddress(p)).toBe("—");
  });

  it("handles addresses with multiple lines joined by space", () => {
    const p: Patient = {
      ...basePatient,
      address: [{ line: ["100 Main St", "Apt 2"], city: "Chicago", state: "IL" }],
    };
    expect(getAddress(p)).toBe("100 Main St Apt 2, Chicago, IL");
  });

  it("skips missing address parts gracefully", () => {
    const p: Patient = { ...basePatient, address: [{ city: "Boston" }] };
    expect(getAddress(p)).toBe("Boston");
  });
});

// ── getLanguage ───────────────────────────────────────────────────────────────

describe("getLanguage", () => {
  it("returns the language text", () => {
    expect(getLanguage(basePatient)).toBe("English");
  });

  it("falls back to coding display when text is absent", () => {
    const p: Patient = {
      ...basePatient,
      communication: [
        { language: { coding: [{ display: "Spanish" }] } },
      ],
    };
    expect(getLanguage(p)).toBe("Spanish");
  });

  it("returns em dash when communication is absent", () => {
    const p: Patient = { ...basePatient, communication: undefined };
    expect(getLanguage(p)).toBe("—");
  });

  it("returns em dash when language has no text or coding", () => {
    const p: Patient = { ...basePatient, communication: [{ language: {} }] };
    expect(getLanguage(p)).toBe("—");
  });
});

// ── extractPatientFromBundle ──────────────────────────────────────────────────

describe("extractPatientFromBundle", () => {
  it("returns a direct Patient resource when resourceType is Patient", () => {
    const data = { resourceType: "Patient", id: "p1" };
    const result = extractPatientFromBundle(data as Record<string, unknown>);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("p1");
  });

  it("extracts a Patient from a Bundle entry", () => {
    const data = {
      resourceType: "Bundle",
      entry: [
        { resource: { resourceType: "Patient", id: "p2" } },
      ],
    };
    const result = extractPatientFromBundle(data as Record<string, unknown>);
    expect(result?.id).toBe("p2");
  });

  it("returns the first Patient from a multi-entry Bundle", () => {
    const data = {
      resourceType: "Bundle",
      entry: [
        { resource: { resourceType: "Observation", id: "o1" } },
        { resource: { resourceType: "Patient", id: "p3" } },
      ],
    };
    const result = extractPatientFromBundle(data as Record<string, unknown>);
    expect(result?.id).toBe("p3");
  });

  it("returns null when Bundle has no Patient entry", () => {
    const data = {
      resourceType: "Bundle",
      entry: [{ resource: { resourceType: "Observation", id: "o1" } }],
    };
    expect(extractPatientFromBundle(data as Record<string, unknown>)).toBeNull();
  });

  it("returns null for an empty Bundle", () => {
    const data = { resourceType: "Bundle", entry: [] };
    expect(extractPatientFromBundle(data as Record<string, unknown>)).toBeNull();
  });

  it("returns null for an unrecognised resourceType", () => {
    const data = { resourceType: "OperationOutcome" };
    expect(extractPatientFromBundle(data as Record<string, unknown>)).toBeNull();
  });
});

// ── getRace ───────────────────────────────────────────────────────────────────

describe("getRace", () => {
  const raceExt: FhirExtension = {
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
    extension: [{ url: "text", valueString: "White" }],
  };

  it("extracts the race text from us-core-race extension", () => {
    expect(getRace([raceExt])).toBe("White");
  });

  it("returns 'Not provided' when extensions are undefined", () => {
    expect(getRace(undefined)).toBe("Not provided");
  });

  it("returns 'Not provided' when the extension is missing", () => {
    const otherExt: FhirExtension = { url: "http://example.com/other" };
    expect(getRace([otherExt])).toBe("Not provided");
  });

  it("returns 'Not provided' when text sub-extension is missing", () => {
    const ext: FhirExtension = {
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
      extension: [{ url: "ombCategory" }],
    };
    expect(getRace([ext])).toBe("Not provided");
  });
});

// ── getEthnicity ──────────────────────────────────────────────────────────────

describe("getEthnicity", () => {
  const ethnExt: FhirExtension = {
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
    extension: [{ url: "text", valueString: "Not Hispanic or Latino" }],
  };

  it("extracts the ethnicity text from us-core-ethnicity extension", () => {
    expect(getEthnicity([ethnExt])).toBe("Not Hispanic or Latino");
  });

  it("returns 'Not provided' when extensions are undefined", () => {
    expect(getEthnicity(undefined)).toBe("Not provided");
  });

  it("returns 'Not provided' when the extension is missing", () => {
    expect(getEthnicity([])).toBe("Not provided");
  });
});

// ── getBirthPlace ─────────────────────────────────────────────────────────────

describe("getBirthPlace", () => {
  const bpExt: FhirExtension = {
    url: "http://hl7.org/fhir/StructureDefinition/patient-birthPlace",
    valueAddress: { city: "Chicago", state: "IL", country: "US" },
  };

  it("extracts the birth place from the extension", () => {
    const result = getBirthPlace([bpExt]);
    expect(result).toContain("Chicago");
    expect(result).toContain("IL");
    expect(result).toContain("US");
  });

  it("returns 'Not provided' when extensions are undefined", () => {
    expect(getBirthPlace(undefined)).toBe("Not provided");
  });

  it("returns 'Not provided' when the extension is missing", () => {
    expect(getBirthPlace([])).toBe("Not provided");
  });

  it("returns 'Not provided' when valueAddress is absent", () => {
    const ext: FhirExtension = {
      url: "http://hl7.org/fhir/StructureDefinition/patient-birthPlace",
    };
    expect(getBirthPlace([ext])).toBe("Not provided");
  });
});

// ── formatName ────────────────────────────────────────────────────────────────

describe("formatName", () => {
  it("formats prefix, given, and family name", () => {
    expect(
      formatName({ prefix: ["Dr."], given: ["Jane"], family: "Doe" }),
    ).toBe("Dr. Jane Doe");
  });

  it("handles name without prefix", () => {
    expect(formatName({ given: ["Bob"], family: "Smith" })).toBe("Bob Smith");
  });

  it("handles name with only family", () => {
    expect(formatName({ family: "Jones" })).toBe("Jones");
  });

  it("handles multiple given names", () => {
    expect(formatName({ given: ["Mary", "Ann"], family: "Lee" })).toBe(
      "Mary Ann Lee",
    );
  });

  it("returns 'Not provided' for undefined", () => {
    expect(formatName(undefined)).toBe("Not provided");
  });
});

// ── getPhone ──────────────────────────────────────────────────────────────────

describe("getPhone", () => {
  it("returns the phone value from telecom", () => {
    expect(
      getPhone([
        { system: "email", value: "a@b.com" },
        { system: "phone", value: "555-1234" },
      ]),
    ).toBe("555-1234");
  });

  it("returns 'Not provided' when no phone entry exists", () => {
    expect(getPhone([{ system: "email", value: "a@b.com" }])).toBe(
      "Not provided",
    );
  });

  it("returns 'Not provided' when telecom is undefined", () => {
    expect(getPhone(undefined)).toBe("Not provided");
  });

  it("returns 'Not provided' when telecom is empty", () => {
    expect(getPhone([])).toBe("Not provided");
  });
});

// ── formatAddress ─────────────────────────────────────────────────────────────

describe("formatAddress", () => {
  it("formats a full address", () => {
    const result = formatAddress([
      {
        line: ["123 Oak Ave"],
        city: "Boston",
        state: "MA",
        postalCode: "02101",
        country: "US",
      },
    ]);
    expect(result).toContain("123 Oak Ave");
    expect(result).toContain("Boston");
    expect(result).toContain("MA");
    expect(result).toContain("02101");
    expect(result).toContain("US");
  });

  it("uses only the first address when multiple are provided", () => {
    const result = formatAddress([
      { city: "Portland", state: "OR" },
      { city: "Seattle", state: "WA" },
    ]);
    expect(result).toContain("Portland");
    expect(result).not.toContain("Seattle");
  });

  it("returns 'Not provided' when address array is undefined", () => {
    expect(formatAddress(undefined)).toBe("Not provided");
  });

  it("returns 'Not provided' when address array is empty", () => {
    expect(formatAddress([])).toBe("Not provided");
  });

  it("handles missing city and state gracefully", () => {
    const result = formatAddress([
      { line: ["100 Main St"], postalCode: "00000" },
    ]);
    expect(result).toContain("100 Main St");
    expect(result).toContain("00000");
  });

  it("joins multiple address lines with a comma", () => {
    const result = formatAddress([
      { line: ["Suite 400", "999 Business Blvd"], city: "Austin", state: "TX" },
    ]);
    expect(result).toContain("Suite 400");
    expect(result).toContain("999 Business Blvd");
  });
});

// ── Integration: getName uses stripNums on full PatientResource ───────────────

describe("getName on PatientResource with numeric suffixes", () => {
  it("strips numeric suffixes added by synthetic data generators", () => {
    const p: PatientResource = {
      resourceType: "Patient",
      id: "pat-synth",
      name: [{ given: ["Jane123", "B456"], family: "Doe789" }],
    };
    expect(getName(p)).toBe("Jane B Doe");
  });
});
