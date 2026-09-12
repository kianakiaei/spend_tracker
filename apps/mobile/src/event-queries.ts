// Event server-state (expo-mobile ticket 06).
//
// Loaders + invalidation scopes for the events list and the detail: per-list
// queries over the typed client with prefix invalidation of the affected
// scopes (no restart). The Expo screens wrap these in
// @tanstack/react-query hooks; the node unit-test seam covers the wire shape
// and the fan-out directly.

export interface EventsListClient {
  events: { list(): Promise<unknown> };
  expenses: { listByMonth(month: string): Promise<unknown> };
}

export interface EventDetailClient {
  events: { list(): Promise<unknown> };
  expenses: { listByMonth(month: string): Promise<unknown> };
  categories: { list(): Promise<unknown> };
}

export interface EventsScreenData {
  events: unknown;
  expenses: unknown;
}

export interface EventDetailMonth {
  events: unknown;
  expenses: unknown;
  categories: unknown;
}

/** Per-list query key: the events surface's one consumption unit. */
export function eventsKey(): string[] {
  return ["events"];
}

/**
 * The list screen's reads: the events plus this month's ledger (per-event
 * totals group client-side — the frozen API exposes no event-summary read).
 */
export async function loadEventsScreen<Out extends EventsScreenData>(
  client: EventsListClient,
  monthKey: string,
): Promise<Out> {
  const [events, expenses] = await Promise.all([
    client.events.list(),
    client.expenses.listByMonth(monthKey),
  ]);
  return { events, expenses } as Out;
}

/** One detail month: the event list (the panel's title/note), this month's
 * ledger rows (this event's own expenses), and the categories for the rows'
 * دسته chips. */
export async function loadEventDetail<Out extends EventDetailMonth>(
  client: EventDetailClient,
  monthKey: string,
): Promise<Out> {
  const [events, expenses, categories] = await Promise.all([
    client.events.list(),
    client.expenses.listByMonth(monthKey),
    client.categories.list(),
  ]);
  return { events, expenses, categories } as Out;
}

export interface EventMutationScopes {
  lists: string[];
}

/** An event mutation touches the events surface plus every dashboard month
 * (ledger rows wear the event title), search hits (eventTitle rides along),
 * and insights (the locked-event Expense sheet writes a خرج). Invalidation
 * is by prefix, so one "dashboard" scope refreshes every open month. */
export function affectedScopesForEventMutation(): EventMutationScopes {
  return { lists: ["events", "dashboard", "search", "insights"] };
}

export interface QueryInvalidator {
  invalidateQueries(options: { queryKey: unknown[] }): unknown;
}

/** Refresh without restart: invalidate the event and dependent scopes so
 * every query refetches (a rename also moves event titles on ledger rows
 * and search hits; a delete unlinks them). */
export async function invalidateEventScopes(
  invalidator: QueryInvalidator,
  scopes: EventMutationScopes,
): Promise<void> {
  await Promise.all(
    scopes.lists.map((scope) => invalidator.invalidateQueries({ queryKey: [scope] })),
  );
}
