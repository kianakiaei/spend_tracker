// Dashboard server-state (expo-mobile ticket 03, spec: "server-state
// management with a query-caching data layer over the typed client:
// per-month and per-list queries, mutations with invalidation of affected
// scopes, pull-to-refresh").
//
// Pure key builders + loaders + invalidation scopes: the Expo screens wrap
// them in @tanstack/react-query hooks, while the node unit-test seam covers
// the wire shape and the invalidation fan-out directly (no restart —
// invalidation is the refresh).

import { effectiveMonthKey } from "./expense-sheet";

export interface DashboardReadClient {
  summaries: { getByMonth(month: string): Promise<unknown> };
  expenses: { listByMonth(month: string): Promise<unknown> };
  recurringTemplates: { preview(month: string): Promise<unknown> };
  categories: { list(): Promise<unknown> };
  events: { list(): Promise<unknown> };
}

export interface DashboardMonth {
  summary: unknown;
  expenses: unknown;
  forecast: unknown;
  categories: unknown;
  events: unknown;
}

/** Per-month query key: the dashboard's one consumption unit. */
export function dashboardKey(monthKey: string): string[] {
  return ["dashboard", monthKey];
}

export const categoriesScope = "categories";
export const eventsScope = "events";
export const searchScope = "search";
export const insightsScope = "insights";

/** One month's reads from the typed client (summary, ledger, forecast,
 * categories for tiles + the sheet, events for the sheet's attach). */
export async function loadDashboardMonth<Out extends DashboardMonth>(
  client: DashboardReadClient,
  monthKey: string,
): Promise<Out> {
  const [summary, expenses, forecast, categories, events] = await Promise.all([
    client.summaries.getByMonth(monthKey),
    client.expenses.listByMonth(monthKey),
    client.recurringTemplates.preview(monthKey),
    client.categories.list(),
    client.events.list(),
  ]);
  return { summary, expenses, forecast, categories, events } as Out;
}

export interface ExpenseSaveScopes {
  months: string[];
  lists: string[];
}

/** Invalidation fan-out for an expense save: the affected ledger month(s)
 * plus every list, summary, and insight scope that reads expenses. */
export function affectedScopesForExpenseSave(args: {
  previousOccurredAt: string | null;
  nextOccurredAt: string;
}): ExpenseSaveScopes {
  const next = effectiveMonthKey(args.nextOccurredAt);
  const months =
    args.previousOccurredAt === null ||
    args.previousOccurredAt === args.nextOccurredAt
      ? [next]
      : (() => {
          const previous = effectiveMonthKey(args.previousOccurredAt);
          return previous === next ? [next] : [previous, next];
        })();
  return {
    months,
    lists: [categoriesScope, eventsScope, searchScope, insightsScope],
  };
}

export interface QueryInvalidator {
  invalidateQueries(options: { queryKey: unknown[] }): unknown;
}

/** Refresh without restart: invalidate the affected months plus the
 * list/insight scopes so every query refetches (pull-to-refresh calls the
 * same invalidator for its month). */
export async function invalidateDashboardScopes(
  invalidator: QueryInvalidator,
  scopes: ExpenseSaveScopes,
): Promise<void> {
  const keys: unknown[][] = [
    ...scopes.months.map((month) => dashboardKey(month)),
    ...scopes.lists.map((scope) => [scope]),
  ];
  await Promise.all(keys.map((queryKey) => invalidator.invalidateQueries({ queryKey })));
}
