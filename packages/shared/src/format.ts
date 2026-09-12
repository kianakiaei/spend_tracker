// Bare-number fa-IR display formats shared by the dashboard components
// (ticket 26). Toman amounts WITH the suffix live in the jalali module
// (formatToman) — these are the companions for ledger/tile amounts and the
// tile share percent, keeping every numeral on the screen Persian.

const faNumber = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const faPercent = new Intl.NumberFormat("fa-IR", {
  style: "percent",
  maximumFractionDigits: 0,
});

/** Integer tomans as grouped Persian digits — ۱۲۴۰۰۰۰ → ۱٬۲۴۰٬۰۰۰. */
export function formatNumber(value: number): string {
  return faNumber.format(value);
}

/** A category's share of the month total — 0.34 → ۳۴٪. */
export function formatPercent(share: number): string {
  return faPercent.format(share);
}
