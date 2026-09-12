// Template server-state (expo-mobile ticket 05).
//
// Loaders + invalidation scopes for the templates surface: the list, the
// categories for names and the sheet, this month's ledger (the generated
// jump map), and the three-month preview fan-out — all over the typed v1
// client (the frozen API). The Expo screens wrap these in
// @tanstack/react-query hooks; the node unit-test seam covers the wire shape
// and the fan-out directly.

import { previewMonthKeys } from "./templates";

export interface TemplatesScreenClient {
  recurringTemplates: {
    list(): Promise<unknown>;
    preview(month: string): Promise<unknown>;
  };
  categories: { list(): Promise<unknown> };
  expenses: { listByMonth(month: string): Promise<unknown> };
  events: { list(): Promise<unknown> };
}

export interface TemplatePreviewMonth {
  monthKey: string;
  rows: unknown;
}

export interface TemplatesScreenData {
  templates: unknown;
  categories: unknown;
  expenses: unknown;
  events: unknown;
  previews: TemplatePreviewMonth[];
}

/** Per-list query key: the templates surface's one consumption unit. */
export function templatesKey(): string[] {
  return ["templates"];
}

/**
 * The templates screen's reads: the list plus the categories (names + the
 * sheet's options), this month's ledger (which templates generated), the
 * event list (the jump sheet's attach), and one preview per horizon month
 * (clamped days come from the server).
 */
export async function loadTemplatesScreen<Out extends TemplatesScreenData>(
  client: TemplatesScreenClient,
  currentMonthKey: string,
): Promise<Out> {
  const months = previewMonthKeys(currentMonthKey);
  const [templates, categories, expenses, events, ...previews] =
    await Promise.all([
      client.recurringTemplates.list(),
      client.categories.list(),
      client.expenses.listByMonth(currentMonthKey),
      client.events.list(),
      ...months.map((month) => client.recurringTemplates.preview(month)),
    ]);
  return {
    templates,
    categories,
    expenses,
    events,
    previews: months.map((monthKey, index) => ({
      monthKey,
      rows: previews[index],
    })),
  } as Out;
}

export interface TemplateMutationScopes {
  lists: string[];
}

/** A template mutation touches the templates surface plus every dashboard
 * month (forecast tiles and ledger rows read previews), the categories list
 * (template counts group from the templates list), search hits (ledger
 * titles/amounts surface in hits), the events list (the templates screen
 * reads events for the jump sheet), and insights. Invalidation
 * is by prefix, so one "dashboard" scope refreshes every open month. */
export function affectedScopesForTemplateMutation(): TemplateMutationScopes {
  return { lists: ["templates", "dashboard", "categories", "insights", "search", "events"] };
}

export interface QueryInvalidator {
  invalidateQueries(options: { queryKey: unknown[] }): unknown;
}

/** Refresh without restart: invalidate the template and dependent scopes so
 * every query refetches (a template save also moves forecast totals and
 * الگو counts). */
export async function invalidateTemplateScopes(
  invalidator: QueryInvalidator,
  scopes: TemplateMutationScopes,
): Promise<void> {
  await Promise.all(
    scopes.lists.map((scope) => invalidator.invalidateQueries({ queryKey: [scope] })),
  );
}
