// Dashboard view model (expo-mobile ticket 03).
//
// The core daily loop: Jalali month navigation with totals plus forecast,
// per-category tiles, and the interleaved recorded-plus-forecast ledger.
// Pure: no React, no Expo, no fetch — the Expo screens feed it DTOs from the
// typed v1 client and render what comes back. Web parity notes:
//
// - Month navigation is unbounded in both directions (month-nav.tsx): the
//   arrows only shift the Jalali month key; past and future are both
//   legitimate views (the future carries the forecast).
// - Tiles are one per category with money this month, largest first, sized
//   by share (summary-tiles.tsx: «کاشیِ بزرگ‌ترین»).
// - Ledger rows interleave on the Jalali day scale, recorded before forecast
//   on a tie (expense-rows.tsx stable sort).

import {
  formatJalali,
  fromISODate,
  jalaliDayOfMonth,
  jalaliMonthKeyLabel,
  jalaliMonthNameFromKey,
  shiftJalaliMonthKey,
  toPersianDigits,
} from "@spend-tracker/shared/jalali";

export interface DashboardCategoryLike {
  id: string;
  name: string;
  color: string | null;
}

export interface DashboardSummaryRow {
  categoryId: string;
  name: string;
  totalToman: number;
  count: number;
}

export interface DashboardSummaryLike {
  monthKey: string;
  totalToman: number;
  byCategory: DashboardSummaryRow[];
  forecastToman?: number;
}

export interface DashboardExpenseLike {
  id: string;
  title: string;
  amountToman: number;
  quantity: number;
  unit: string;
  occurredAt: string;
  categoryId: string;
  category: { color: string | null };
  eventId: string | null;
  sourceRecurringId: string | null;
}

export interface DashboardForecastLike {
  templateId: string;
  title: string;
  amountToman: number;
  categoryId: string;
  day: number;
}

export interface DashboardEventLike {
  id: string;
  title: string;
}

export interface DashboardTile {
  categoryId: string;
  name: string;
  totalToman: number;
  count: number;
  /** Share of the month total (0..1) — the tile size. */
  share: number;
  color: string | null;
  /** Stack drilldown for the category (back navigation keeps context). */
  drilldown: string;
}

export interface DashboardLedgerExpenseRow {
  kind: "expense";
  id: string;
  day: number;
  dayLabel: string;
  title: string;
  amountToman: number;
  quantity: number;
  unit: string;
  categoryId: string;
  categoryColor: string | null;
  eventTitle: string | null;
  fromTemplate: boolean;
  badge: string | null;
}

export interface DashboardLedgerForecastRow {
  kind: "forecast";
  templateId: string;
  day: number;
  dayLabel: string;
  title: string;
  amountToman: number;
  categoryId: string;
  categoryColor: string | null;
  /** Every forecast row is badged as an estimate. */
  badge: "پیش‌بینی";
}

export type DashboardLedgerRow =
  | DashboardLedgerExpenseRow
  | DashboardLedgerForecastRow;

export interface DashboardViewModel {
  monthKey: string;
  monthLabel: string;
  totalToman: number;
  forecastToman?: number;
  tiles: DashboardTile[];
  ledger: DashboardLedgerRow[];
  isEmpty: boolean;
}

/** Unbounded Jalali month step ('1405-12' + 1 → '1406-01'). Invalid keys
 * throw — the screen canonicalizes its month param before calling. */
export function shiftDashboardMonth(monthKey: string, delta: number): string {
  return shiftJalaliMonthKey(monthKey, delta);
}

export function buildDashboardViewModel(args: {
  monthKey: string;
  summary: DashboardSummaryLike;
  expenses: DashboardExpenseLike[];
  forecast: DashboardForecastLike[];
  categories: DashboardCategoryLike[];
  events?: DashboardEventLike[];
}): DashboardViewModel {
  const { monthKey, summary, expenses, forecast, categories } = args;
  const colorOf = new Map(categories.map((c) => [c.id, c.color]));
  const eventTitleOf = new Map((args.events ?? []).map((e) => [e.id, e.title]));
  const total = summary.totalToman;

  // Largest first — the anchor tile is the biggest share (web parity).
  const tiles: DashboardTile[] = [...summary.byCategory]
    .sort((a, b) => b.totalToman - a.totalToman)
    .map((row) => ({
      categoryId: row.categoryId,
      name: row.name,
      totalToman: row.totalToman,
      count: row.count,
      share: total > 0 ? row.totalToman / total : 0,
      color: colorOf.get(row.categoryId) ?? null,
      drilldown: `/category/${row.categoryId}`,
    }));

  const monthName = jalaliMonthNameFromKey(monthKey);
  const expenseRows: DashboardLedgerExpenseRow[] = expenses.map((e) => {
    const fromTemplate = e.sourceRecurringId !== null;
    return {
      kind: "expense" as const,
      id: e.id,
      day: jalaliDayOfMonth(fromISODate(e.occurredAt)),
      dayLabel: formatJalali(fromISODate(e.occurredAt), "d MMMM"),
      title: e.title,
      amountToman: e.amountToman,
      quantity: e.quantity,
      unit: e.unit,
      categoryId: e.categoryId,
      categoryColor: e.category?.color ?? null,
      eventTitle:
        e.eventId !== null ? (eventTitleOf.get(e.eventId) ?? null) : null,
      fromTemplate,
      badge: fromTemplate ? "از الگو" : null,
    };
  });
  const forecastRows: DashboardLedgerForecastRow[] = forecast.map((row) => ({
    kind: "forecast" as const,
    templateId: row.templateId,
    day: row.day,
    dayLabel: `${toPersianDigits(row.day)} ${monthName}`,
    title: row.title,
    amountToman: row.amountToman,
    categoryId: row.categoryId,
    categoryColor: colorOf.get(row.categoryId) ?? null,
    badge: "پیش‌بینی",
  }));

  // Chronological on the Jalali day scale, recorded before forecast on a
  // tie — the resolved service order the web ledger renders.
  const order = new Map<DashboardLedgerRow, number>();
  const ledger: DashboardLedgerRow[] = [...expenseRows, ...forecastRows];
  ledger.forEach((row, index) => order.set(row, index));
  ledger.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    if (a.kind !== b.kind) return a.kind === "expense" ? -1 : 1;
    return order.get(a)! - order.get(b)!;
  });

  return {
    monthKey,
    monthLabel: jalaliMonthKeyLabel(monthKey),
    totalToman: summary.totalToman,
    ...(summary.forecastToman !== undefined
      ? { forecastToman: summary.forecastToman }
      : {}),
    tiles,
    ledger,
    isEmpty: expenses.length === 0 && forecast.length === 0,
  };
}
