// Search server-state (expo-mobile ticket 07).
//
// Loaders + query keys for the whole-ledger search: one debounced query over
// the typed client plus the categories/events the Expense edit sheet needs.
// The Expo screen wraps these in @tanstack/react-query hooks; the node
// unit-test seam covers the wire shape directly.
//
// Invalidation: search owns no mutations, so there is no invalidator here —
// the expense-save fan-out in queries.ts already refreshes the "search"
// scope (a save changes titles, amounts, and event links on hits), and the
// event fan-out covers renames/unlinks. Pull-to-refresh refetches the active
// query.

import { canonical } from "@spend-tracker/shared/normalize";

export interface SearchScreenClient {
  search: { byTitle(q: string): Promise<unknown> };
  categories: { list(): Promise<unknown> };
  events: { list(): Promise<unknown> };
}

export interface SearchScreenData {
  hits: unknown;
  categories: unknown;
  events: unknown;
}

/** Per-query key: each debounced query caches separately. */
export function searchKey(query: string): string[] {
  return ["search", query];
}

/** The search screen's reads: the frozen search endpoint plus the sheet's
 * pickers. A blank query short-circuits to [] without touching the search
 * endpoint — exactly what the server answers for blank q. */
export async function loadSearchScreen<Out extends SearchScreenData>(
  client: SearchScreenClient,
  query: string,
): Promise<Out> {
  const trimmed = query.trim();
  const [hits, categories, events] = await Promise.all([
    canonical(trimmed) === ""
      ? Promise.resolve([])
      : client.search.byTitle(trimmed),
    client.categories.list(),
    client.events.list(),
  ]);
  return { hits, categories, events } as Out;
}
