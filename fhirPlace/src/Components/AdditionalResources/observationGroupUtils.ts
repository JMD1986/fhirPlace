import type { ObservationResource } from "./additionalResourceTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DataPoint {
  date: string; // formatted label
  rawDate: string; // ISO for sorting
  [seriesKey: string]: string | number;
}

export interface ObsGroup {
  key: string;
  name: string;
  unit: string;
  points: DataPoint[];
  series: string[];
  nonNumeric: ObservationResource[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const fmtObsDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "2-digit",
      })
    : "";

/** Return the LOINC code (or code.text) as a stable grouping key */
export const obsKey = (obs: ObservationResource): string =>
  obs.code?.coding?.[0]?.code ?? obs.code?.text ?? "unknown";

/** Human-readable name for an observation group */
export const obsName = (obs: ObservationResource): string =>
  obs.code?.text ?? obs.code?.coding?.[0]?.display ?? "Observation";

// ── Build groups from a flat list of observations ─────────────────────────────

export function buildGroups(observations: ObservationResource[]): ObsGroup[] {
  const map = new Map<string, ObservationResource[]>();

  for (const obs of observations) {
    const k = obsKey(obs);
    const existing = map.get(k) ?? [];
    existing.push(obs);
    map.set(k, existing);
  }

  const groups: ObsGroup[] = [];

  for (const [key, obsList] of map.entries()) {
    const sorted = [...obsList].sort((a, b) =>
      (a.effectiveDateTime ?? "").localeCompare(b.effectiveDateTime ?? ""),
    );

    const name = obsName(sorted[0]);
    const nonNumeric: ObservationResource[] = [];
    const points: DataPoint[] = [];
    const seriesSet = new Set<string>();

    for (const obs of sorted) {
      const rawDate = obs.effectiveDateTime ?? obs.issued ?? "";
      const date = fmtObsDate(rawDate);

      if (obs.component && obs.component.length > 0) {
        const point: DataPoint = { date, rawDate };
        let hasValue = false;
        for (const c of obs.component) {
          if (c.valueQuantity?.value !== undefined) {
            const seriesName =
              c.code?.text ?? c.code?.coding?.[0]?.display ?? "Component";
            point[seriesName] = c.valueQuantity.value;
            seriesSet.add(seriesName);
            hasValue = true;
          }
        }
        if (hasValue) points.push(point);
        else nonNumeric.push(obs);
        continue;
      }

      if (obs.valueQuantity?.value !== undefined) {
        const seriesName = name;
        seriesSet.add(seriesName);
        points.push({ date, rawDate, [seriesName]: obs.valueQuantity.value });
        continue;
      }

      nonNumeric.push(obs);
    }

    if (points.length === 0 && nonNumeric.length === 0) continue;

    const unit =
      sorted.find((o) => o.valueQuantity?.unit)?.valueQuantity?.unit ??
      sorted
        .find((o) => o.component?.some((c) => c.valueQuantity?.unit))
        ?.component?.find((c) => c.valueQuantity?.unit)?.valueQuantity?.unit ??
      "";

    groups.push({ key, name, unit, points, series: [...seriesSet], nonNumeric });
  }

  return groups.sort((a, b) => {
    if (a.points.length > 0 && b.points.length === 0) return -1;
    if (a.points.length === 0 && b.points.length > 0) return 1;
    return a.name.localeCompare(b.name);
  });
}
