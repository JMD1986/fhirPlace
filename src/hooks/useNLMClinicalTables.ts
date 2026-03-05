import { useState, useEffect } from "react";
import { set } from "supertest/lib/cookies";

const BASE = "https://clinicaltables.nlm.nih.gov/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NLMConditionInfo {
  consumerName: string;   // e.g. "High blood pressure (hypertension (HTN))"
  medlinePlusUrl: string; // e.g. "http://www.nlm.nih.gov/medlineplus/..."
  medlinePlusLabel: string; // e.g. "High Blood Pressure"
  icd10Code: string;      // e.g. "I10"
  loading: boolean;
  error: string | null;
}

export interface NLMLoincInfo {
  loincNum: string;        // e.g. "8867-4"
  component: string;       // e.g. "Heart rate"
  shortName: string;       // e.g. "Heart rate"
  exampleUnits: string;    // e.g. "/min"
  description: string;     // long description (may be empty)
  method: string;          // e.g. "Automated count"
  orderObs: string;        // "Order" | "Observation" | "Both" | "Subset"
  loincClass: string;      // e.g. "PANEL.HEMATOLOGY&COAGULATION"
  loading: boolean;
  error: string | null;
}

// ─── Response shape from NLM Clinical Tables ─────────────────────────────────
// [totalCount, [ids...], null, [[field1, field2, ...], ...]]
type NLMResponse = [number, string[], null, string[][]];

// ─── Hook: Conditions (SNOMED / name lookup) ──────────────────────────────────

/**
 * Looks up NLM MedlinePlus condition info by condition text name.
 * Returns consumer-friendly name, MedlinePlus URL, and ICD-10 code.
 *
 * @param conditionName The display text of the condition code,
 *   e.g. "Diabetes mellitus type 2 (disorder)"
 */
export function useNLMCondition(conditionName?: string): NLMConditionInfo {
  const [data, setData] = useState<Omit<NLMConditionInfo, "loading" | "error">>({
    consumerName: "",
    medlinePlusUrl: "",
    medlinePlusLabel: "",
    icd10Code: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conditionName) return;

    let cancelled = false;

    // Strip SNOMED parenthetical tags like "(disorder)" or "(finding)"
    const cleanName = conditionName
      .replace(/\s*\(disorder\)\s*/i, "")
      .replace(/\s*\(finding\)\s*/i, "")
      .replace(/\s*\(situation\)\s*/i, "")
      .trim();

    // Take first meaningful keyword phrase (up to 3 words) for the search
    const searchTerm = cleanName.split(/\s+/).slice(0, 4).join(" ");

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const url =
          `${BASE}/conditions/v3/search` +
          `?terms=${encodeURIComponent(searchTerm)}` +
          `&df=consumer_name,info_link_data,icd10cm_codes` +
          `&maxList=5`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`NLM request failed: ${res.status}`);

        const json: NLMResponse = await res.json();
        const rows = json[3]; // array of field arrays

        if (!rows || rows.length === 0) {
          if (!cancelled) {
            setData({ consumerName: "", medlinePlusUrl: "", medlinePlusLabel: "", icd10Code: "" });
          }
          return;
        }

        // Pick the best match — prefer exact (case-insensitive) match on the
        // clean name, otherwise fall back to the first result
        const bestIdx =
          rows.findIndex((r) =>
            r[0].toLowerCase().includes(cleanName.toLowerCase().split(/\s+/)[0]),
          ) ?? 0;
        const row = rows[Math.max(0, bestIdx)];

        // info_link_data format: "url,Label"
        const [mlUrl = "", mlLabel = ""] = (row[1] ?? "").split(",");
        const icd10 = row[2] ?? "";

        if (!cancelled) {
          setData({
            consumerName: row[0] ?? "",
            medlinePlusUrl: mlUrl,
            medlinePlusLabel: mlLabel,
            icd10Code: icd10,
          });
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [conditionName]);

  return { ...data, loading, error };
}

// ─── Hook: LOINC (Observation code lookup) ───────────────────────────────────

/**
 * Looks up LOINC code details from NLM Clinical Tables.
 *
 * @param loincCode  The LOINC code string, e.g. "8867-4"
 * @param codeName   Fallback display name (used if no code provided)
 */
export function useNLMLoinc(loincCode?: string, codeName?: string): NLMLoincInfo {
  const [data, setData] = useState<Omit<NLMLoincInfo, "loading" | "error">>({
    loincNum: "",
    component: "",
    shortName: "",
    exampleUnits: "",
    description: "",
    method: "",
    orderObs: "",
    loincClass: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchTerm = loincCode ?? codeName;
    if (!searchTerm) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // If we have a LOINC code, search by it directly (sf=LOINC_NUM)
        const sfParam = loincCode ? "&sf=LOINC_NUM" : "";
        const url =
          `${BASE}/loinc_items/v3/search` +
          `?terms=${encodeURIComponent(searchTerm)}` +
          `&df=LOINC_NUM,COMPONENT,SHORTNAME,EXAMPLE_UCUM_UNITS,DefinitionDescription,METHOD_TYP,ORDER_OBS,CLASS` +
          `&maxList=1` +
          sfParam;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`NLM LOINC request failed: ${res.status}`);

        const json: NLMResponse = await res.json();
        const rows = json[3];

        if (!rows || rows.length === 0) {
          if (!cancelled) {
            setData({ loincNum: "", component: "", shortName: "", exampleUnits: "", description: "", method: "", orderObs: "", loincClass: "" });
          }
          return;
        }

        const [lNum = "", comp = "", short = "", units = "", def = "", method = "", orderObs = "", loincClass = ""] = rows[0];

        if (!cancelled) {
          setData({
            loincNum: lNum,
            component: comp,
            shortName: short,
            exampleUnits: units,
            description: def,
            method,
            orderObs,
            loincClass,
          });
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [loincCode, codeName]);

  return { ...data, loading, error };
}
