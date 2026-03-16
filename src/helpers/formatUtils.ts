// formatUtils.ts
// Shared formatting helpers for Patient and AdditionalResources components

export const fmtUSD = (val: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);

export const shortMonth = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "2-digit", month: "short" });
};

// Standard FHIR date/time formatter used in AdditionalResources views
export const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// Currency formatter used in ClaimsView, EoBView, etc.
export const fmtCurrency = (val?: number, cur?: string) =>
  val !== undefined ? `${cur ?? "USD"} ${val.toFixed(2)}` : "—";

// Duration formatter from ProcedureView
export const formatDuration = (start?: string, end?: string) => {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs} hr ${rem} min` : `${hrs} hr`;
};
