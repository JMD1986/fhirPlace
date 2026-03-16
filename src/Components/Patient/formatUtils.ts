// formatUtils.ts
// Shared formatting helpers for Patient components

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
