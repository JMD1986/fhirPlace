import { useState, useEffect } from "react";

const BASE = "https://rxnav.nlm.nih.gov/REST";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RxNormDrugClass {
  classId: string;
  className: string;
  classType: string; // "EPC" | "MOA" | "ATC1-4" | "CHEM" | etc.
  rela: string;      // "has_epc" | "has_moa" | "has_chemical_structure" | etc.
}

export interface RxNormData {
  ingredientName: string;       // resolved ingredient (IN) name, e.g. "amoxicillin"
  ingredientRxcui: string;      // ingredient-level rxcui
  brandNames: string[];         // brand name equivalents, e.g. ["Augmentin"]
  brandedProducts: string[];    // full branded clinical drug names (SBD)
  drugClasses: RxNormDrugClass[]; // EPC, MOA, ATC, CHEM classes
  loading: boolean;
  error: string | null;
}

// ─── Internal response shapes ─────────────────────────────────────────────────

interface RxNormConceptProperty {
  rxcui: string;
  name: string;
  tty: string;
}

interface RxNormRelatedGroup {
  relatedGroup: {
    conceptGroup: { tty: string; conceptProperties?: RxNormConceptProperty[] }[];
  };
}

interface RxNormClassItem {
  rxclassMinConceptItem: {
    classId: string;
    className: string;
    classType: string;
  };
  rela: string;
}

interface RxNormClassResponse {
  rxclassDrugInfoList?: {
    rxclassDrugInfo: RxNormClassItem[];
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches RxNorm drug info for a given rxcui (SCD/SBD/IN level).
 * Resolves brand names, ingredient, and drug class from:
 *  - /rxcui/{id}/related.json?tty=IN  → ingredient name + rxcui
 *  - /rxcui/{id}/allrelated.json       → brand names (BN) + branded products (SBD)
 *  - /rxclass/class/byRxcui.json       → drug class (EPC, MOA, ATC)
 *
 * @param rxcui  RxNorm code from medicationCodeableConcept.coding[].code
 */
export function useRxNorm(rxcui?: string): RxNormData {
  const [ingredientName, setIngredientName] = useState("");
  const [ingredientRxcui, setIngredientRxcui] = useState("");
  const [brandNames, setBrandNames] = useState<string[]>([]);
  const [brandedProducts, setBrandedProducts] = useState<string[]>([]);
  const [drugClasses, setDrugClasses] = useState<RxNormDrugClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rxcui) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setIngredientName("");
      setIngredientRxcui("");
      setBrandNames([]);
      setBrandedProducts([]);
      setDrugClasses([]);

      try {
        // ── Step 1: Resolve to ingredient (IN) level ──────────────────────────
        const ingredientRes = await fetch(
          `${BASE}/rxcui/${rxcui}/related.json?tty=IN`,
        );
        if (!ingredientRes.ok) throw new Error("RxNorm ingredient lookup failed");

        const ingredientData: RxNormRelatedGroup = await ingredientRes.json();
        const inGroup = ingredientData.relatedGroup.conceptGroup.find(
          (g) => g.tty === "IN",
        );
        const inConcept = inGroup?.conceptProperties?.[0];
        const resolvedIngredientRxcui = inConcept?.rxcui ?? rxcui;
        const resolvedIngredientName = inConcept?.name ?? "";

        if (cancelled) return;
        setIngredientName(resolvedIngredientName);
        setIngredientRxcui(resolvedIngredientRxcui);

        // ── Step 2 & 3: Brand names + drug class (parallel) ──────────────────
        const [allRelatedRes, classRes] = await Promise.allSettled([
          fetch(`${BASE}/rxcui/${rxcui}/allrelated.json`),
          fetch(
            `${BASE}/rxclass/class/byRxcui.json` +
              `?rxcui=${resolvedIngredientRxcui}&relaSource=DAILYMED`,
          ),
        ]);

        if (cancelled) return;

        // ── Brand names from allrelated ──
        if (allRelatedRes.status === "fulfilled" && allRelatedRes.value.ok) {
          const data = await allRelatedRes.value.json();
          const groups: { tty: string; conceptProperties?: RxNormConceptProperty[] }[] =
            data?.allRelatedGroup?.conceptGroup ?? [];

          const bnGroup = groups.find((g) => g.tty === "BN");
          const sbdGroup = groups.find((g) => g.tty === "SBD");

          if (!cancelled) {
            setBrandNames(
              (bnGroup?.conceptProperties ?? []).map((p) => p.name).slice(0, 6),
            );
            setBrandedProducts(
              (sbdGroup?.conceptProperties ?? []).map((p) => p.name).slice(0, 4),
            );
          }
        }

        // ── Drug classes from RxClass ──
        if (classRes.status === "fulfilled" && classRes.value.ok) {
          const data: RxNormClassResponse = await classRes.value.json();
          const rawClasses = data?.rxclassDrugInfoList?.rxclassDrugInfo ?? [];

          // De-duplicate by classId, keep EPC + MOA + ATC + CHEM
          const seen = new Set<string>();
          const classes: RxNormDrugClass[] = [];
          const priority = ["EPC", "MOA", "ATC1-4", "CHEM"];

          for (const item of rawClasses) {
            const c = item.rxclassMinConceptItem;
            if (!seen.has(c.classId) && priority.includes(c.classType)) {
              seen.add(c.classId);
              classes.push({
                classId: c.classId,
                className: c.className,
                classType: c.classType,
                rela: item.rela,
              });
            }
          }

          if (!cancelled) setDrugClasses(classes);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [rxcui]);

  return {
    ingredientName,
    ingredientRxcui,
    brandNames,
    brandedProducts,
    drugClasses,
    loading,
    error,
  };
}
