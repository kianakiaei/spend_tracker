// Insights server-state (expo-mobile ticket 08).
//
// Loaders + query keys for the repeat-purchase board: one ledger read per
// window month over the typed client (the frozen API exposes no insights
// read), grouped client-side by the insights core. The Expo screen wraps
// these in @tanstack/react-query hooks; the node unit-test seam covers the
// wire shape and the fan-out directly.
//
// Invalidation: insights owns no mutations, so there is no invalidator here —
// the expense-save, category, template, and event fan-outs already refresh
// the "insights" scope (a save changes the rows behind every average).
// Pull-to-refresh refetches the window.

import { insightWindowKeys } from "./insights";

export interface InsightsLedgerClient {
  expenses: { listByMonth(month: string): Promise<unknown> };
}

export interface InsightsScreenData {
  expenses: unknown;
  monthKeys: string[];
}

/** Per-list query key: the insights surface's one consumption unit. */
export function insightsKey(): string[] {
  return ["insights"];
}

/** One window of reads: the trailing 12 Jalali months in parallel, flattened
 * oldest-first. Empty months answer [] — they cost a read but no rows. */
export async function loadInsightsScreen<Out extends InsightsScreenData>(
  client: InsightsLedgerClient,
  currentMonthKey: string,
): Promise<Out> {
  const monthKeys = insightWindowKeys(currentMonthKey);
  const pages = await Promise.all(
    monthKeys.map((month) => client.expenses.listByMonth(month)),
  );
  const expenses = (pages as unknown[][]).flat();
  return { expenses, monthKeys } as Out;
}
