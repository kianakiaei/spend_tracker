// Category server-state (expo-mobile ticket 04).
//
// Loaders + invalidation scopes for the categories list and the drilldown:
// per-list queries over the typed client with prefix invalidation of the
// affected scopes (no restart). The Expo screens wrap these in
// @tanstack/react-query hooks; the node unit-test seam covers the wire shape
// and the fan-out directly.

export interface CategoriesListClient {
  categories: { list(): Promise<unknown> };
  recurringTemplates: { list(): Promise<unknown> };
  summaries: { getByMonth(month: string): Promise<unknown> };
}

export interface CategoryDrilldownClient {
  summaries: { getByMonth(month: string): Promise<unknown> };
  expenses: { listByMonth(month: string): Promise<unknown> };
  recurringTemplates: { preview(month: string): Promise<unknown> };
  categories: { list(): Promise<unknown> };
  events: { list(): Promise<unknown> };
}

export interface CategoriesScreenData {
  categories: unknown;
  templates: unknown;
  summary: unknown;
}

export interface CategoryDrilldownMonth {
  summary: unknown;
  expenses: unknown;
  forecast: unknown;
  categories: unknown;
  events: unknown;
}

/** Per-list query key: the categories surface's one consumption unit. */
export function categoriesKey(): string[] {
  return ["categories"];
}

export function templatesScope(): string[] {
  return ["templates"];
}

/**
 * The list screen's reads: categories plus the templates list (all-time
 * الگو counts group client-side) plus the month summary (per-month خرج
 * counts — the frozen API exposes no all-time GROUP-BY read).
 */
export async function loadCategoriesScreen<Out extends CategoriesScreenData>(
  client: CategoriesListClient,
  monthKey: string,
): Promise<Out> {
  const [categories, templates, summary] = await Promise.all([
    client.categories.list(),
    client.recurringTemplates.list(),
    client.summaries.getByMonth(monthKey),
  ]);
  return { categories, templates, summary } as Out;
}

/** One drilldown month: this category's total, its ledger rows, and the
 * forecast rows, plus the category list for names and colors and the event
 * list for the sheet's attach. */
export async function loadCategoryDrilldown<Out extends CategoryDrilldownMonth>(
  client: CategoryDrilldownClient,
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

export interface CategoryMutationScopes {
  lists: string[];
}

/** A category mutation touches the list surface plus every dashboard month
 * (tiles, the sheet's category options, and drilldown totals all read
 * categories), search hits (they carry category names), and the events list
 * (the drilldown reads events for the sheet's attach). Invalidation is by
 * prefix, so one "dashboard" scope refreshes every open month. */
export function affectedScopesForCategoryMutation(): CategoryMutationScopes {
  return { lists: ["categories", "dashboard", "templates", "insights", "search", "events"] };
}

export interface QueryInvalidator {
  invalidateQueries(options: { queryKey: unknown[] }): unknown;
}

/** Refresh without restart: invalidate the list scopes so every query
 * refetches (a category save also moves خرج counts, tile names, and
 * drilldown totals). */
export async function invalidateCategoryScopes(
  invalidator: QueryInvalidator,
  scopes: CategoryMutationScopes,
): Promise<void> {
  await Promise.all(
    scopes.lists.map((scope) => invalidator.invalidateQueries({ queryKey: [scope] })),
  );
}
