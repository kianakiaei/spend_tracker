// Repeat-purchase insights core (expo-mobile ticket 08).
//
// The top-products board: repeat titles with overall weighted average unit
// price and count, monthly average-unit-price trends, and per-product
// purchase history. Pure: no React, no Expo, no fetch — the Expo screen feeds
// it ledger DTOs from the typed v1 client and renders what comes back.
//
// Web parity (insights-service.ts getTopProductsAllTime + insights-board.tsx):
// - Repeat titles group by the engine's canonical form; blank titles and
//   single purchases drop out; rows sort by count then total, capped at 20.
// - displayTitle is the earliest purchase's trimmed title (occurredAt, then
//   createdAt, then id — the service's order).
// - مبلغِ خرج همیشه جمعِ کل است: the unit price is «مبلغ ÷ تعداد» and every
//   average is the weighted mean (جمع مبالغ ÷ جمع تعدادها) rounded to whole
//   tomans, via the shared quantity helpers; missing quantities default to 1.
// - The monthly trend buckets weighted averages by month ascending; the
//   overall average is the trend's reference; history runs newest first
//   (occurredAt, then expenseId — the board's order).
//
// Frozen-API note (spec: no new endpoints): the web page reads the insights
// service directly (all-time rows). The frozen API exposes no insights read —
// only the month-scoped ledger — so the loader (insights-queries.ts) fans out
// expenses.listByMonth over the trailing INSIGHT_MONTHS window and this
// module groups client-side. The board labels the window honestly
// («۱۲ ماه اخیر»); an all-time board needs a new frozen-API read.

import { canonical } from "@spend-tracker/shared/normalize";
import {
  averageUnitPrice,
  totalQuantity,
  unitPrice,
} from "@spend-tracker/shared/quantity";
import { shiftJalaliMonthKey } from "@spend-tracker/shared/jalali";

/** The trailing window the loader fans out (bounded: one ledger read per
 * month). Labelled honestly on the board — never passed off as all-time. */
export const INSIGHT_MONTHS = 12;

/** Board cap, matching the web page's limit. */
export const INSIGHT_LIMIT = 20;

export const INSIGHT_MESSAGES = {
  emptyList:
    "هنوز خرید تکراری نیست. چند خرج با عنوان یکسان (مثلاً نان) ثبت کنید.",
  noFilterHits: "محصولی با این عنوان پیدا نشد.",
  windowHint: "میانگین‌ها از ۱۲ ماه اخیر ساخته می‌شوند.",
  loadFailed: "ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.",
} as const;

export interface InsightExpenseLike {
  id: string;
  title: string;
  amountToman: number;
  quantity: number | null;
  monthKey: string;
  occurredAt: string;
  createdAt: string;
}

export interface InsightsMonthAvg {
  monthKey: string;
  count: number;
  avgUnitPrice: number;
}

export interface InsightsPoint {
  expenseId: string;
  monthKey: string;
  occurredAt: string;
  unitPrice: number;
  quantity: number;
  amountToman: number;
}

export interface ProductInsight {
  key: string;
  displayTitle: string;
  count: number;
  totalToman: number;
  totalQuantity: number;
  overallAvgUnit: number;
  monthly: InsightsMonthAvg[];
  points: InsightsPoint[];
}

/** The trailing window, ascending (oldest first), ending at the current
 * Jalali month. */
export function insightWindowKeys(currentMonthKey: string): string[] {
  const keys: string[] = [];
  for (let i = INSIGHT_MONTHS - 1; i >= 0; i--) {
    keys.push(shiftJalaliMonthKey(currentMonthKey, -i));
  }
  return keys;
}

/** Earliest purchase first — its trimmed title names the product. */
function byPurchaseOrder(a: InsightExpenseLike, b: InsightExpenseLike): number {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

/** Repeat titles with weighted averages (web getTopProductsAllTime parity). */
export function buildProductInsights(
  expenses: readonly InsightExpenseLike[],
): ProductInsight[] {
  const groups = new Map<string, InsightExpenseLike[]>();
  for (const row of expenses) {
    const key = canonical(row.title);
    if (key === "") continue;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const products: ProductInsight[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(byPurchaseOrder);
    const totalToman = sorted.reduce((sum, r) => sum + r.amountToman, 0);
    const totalQty = totalQuantity(sorted.map((r) => r.quantity));
    const byMonth = new Map<string, { amount: number; qty: number; n: number }>();
    for (const row of sorted) {
      const bucket = byMonth.get(row.monthKey);
      if (bucket) {
        bucket.amount += row.amountToman;
        bucket.qty += row.quantity ?? 1;
        bucket.n += 1;
      } else {
        byMonth.set(row.monthKey, {
          amount: row.amountToman,
          qty: row.quantity ?? 1,
          n: 1,
        });
      }
    }
    products.push({
      key,
      displayTitle: sorted[0]!.title.trim(),
      count: sorted.length,
      totalToman,
      totalQuantity: totalQty,
      overallAvgUnit: averageUnitPrice(totalToman, totalQty),
      monthly: [...byMonth.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([monthKey, b]) => ({
          monthKey,
          count: b.n,
          avgUnitPrice: averageUnitPrice(b.amount, b.qty),
        })),
      points: sorted.map((r) => ({
        expenseId: r.id,
        monthKey: r.monthKey,
        occurredAt: r.occurredAt,
        unitPrice: unitPrice(r.amountToman, r.quantity),
        quantity: r.quantity ?? 1,
        amountToman: r.amountToman,
      })),
    });
  }

  products.sort((a, b) => b.count - a.count || b.totalToman - a.totalToman);
  return products.slice(0, INSIGHT_LIMIT);
}

/** Purchase history, newest first (web board parity). */
export function historyFor(product: ProductInsight): InsightsPoint[] {
  return [...product.points].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt)
      return a.occurredAt < b.occurredAt ? 1 : -1;
    return a.expenseId < b.expenseId ? 1 : -1;
  });
}
