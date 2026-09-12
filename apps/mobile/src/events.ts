// Event buckets core (expo-mobile ticket 06).
//
// Event buckets as a second layer over categorized monthly expenses: list
// with totals, create/rename, detail with locked-event entry, and
// unlink-only deletion. Pure: no React, no Expo, no fetch — the Expo
// screens feed it DTOs from the typed v1 client and render what comes back.
//
// Web parity (events/page.tsx + events-manager.tsx + events/[id]/page.tsx +
// event-detail.tsx):
// - Rows list in server (creation) order; each links to its stack detail.
// - Create takes a title plus an optional note; rename is title-only.
// - Deleting an event only unlinks expenses (they keep category + month) —
//   the confirm says so («خرج‌ها می‌مانند») and the core never issues an
//   expense write for a delete.
// - The detail panel carries the event's own rows; «افزودن به این رویداد»
//   opens the Expense sheet with the event pre-selected.
// - Every row in an event keeps its own category and occurrence month: the
//   event is a pure overlay, never a replacement for categorization.
//
// Frozen-API note (spec: no new endpoints): the web page reads all-time
// totals and the full expense list from services the API does not expose,
// so mobile shows this month's total + count per event (labelled as such
// with Persian digits — the ticket-04 precedent) and the detail carries an
// unbounded month navigator like the category drilldown.

import {
  formatToman,
  toPersianDigits,
} from "@spend-tracker/shared/jalali";
import type {
  CreateEventRequest,
  UpdateEventRequest,
} from "@spend-tracker/shared/schemas/api";

export interface EventLike {
  id: string;
  title: string;
  note: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface EventLedgerExpenseLike {
  id: string;
  eventId: string | null;
  categoryId: string;
  monthKey: string;
  occurredAt: string;
  title: string;
  amountToman: number;
}

/** Persian voice, mirroring the web manager's generic failure line. */
export const EVENT_MESSAGES = {
  saveFailed: "انجام نشد؛ دوباره تلاش کنید.",
  emptyList: "هنوز رویدادی نیست. برای سفر یا مناسبت بعدی یکی بسازید.",
  deleteConfirm: "رویداد حذف شود؟ خرج‌ها می‌مانند.",
  monthScopedHint:
    "هر رویداد یک جمع اضافه است؛ شمار و جمع هر رویداد برای ماه جاری است. حذف رویداد فقط پیوند را برمی‌دارد، نه خرج‌ها را.",
} as const;

export interface EventRow extends EventLike {
  totalToman: number;
  count: number;
  overlayLabel: string;
  /** Stack detail pushed above the tabs (back keeps context). */
  drilldown: string;
}

/** «{fa-count} خرج در این ماه · {toman} تومان» — the month scope is honest:
 * the frozen API exposes no all-time event read (ticket-04 precedent). */
function overlayLabelFor(args: {
  totalToman: number;
  count: number;
}): string {
  if (args.count === 0) return "بدون خرج در این ماه";
  return `${toPersianDigits(args.count)} خرج در این ماه · ${formatToman(args.totalToman)} تومان`;
}

/** Rows in server order, each with this month's total + count overlay and
 * its stack detail link. Totals group in one pass (no per-row scan). */
export function buildEventListViewModel(args: {
  events: EventLike[];
  expenses: EventLedgerExpenseLike[];
}): { rows: EventRow[] } {
  const totals = totalByEventId(args.expenses);
  const rows: EventRow[] = args.events.map((event) => {
    const { totalToman, count } = totals[event.id] ?? { totalToman: 0, count: 0 };
    return {
      ...event,
      totalToman,
      count,
      overlayLabel: overlayLabelFor({ totalToman, count }),
      drilldown: `/event/${event.id}`,
    };
  });
  return { rows };
}

/** A title is usable when it holds a non-blank word after trimming. */
export function validateEventTitle(title: string): boolean {
  return title.trim() !== "";
}

/** Full create payload (title + optional note, web parity), or null while
 * the title is blank. */
export function buildCreateEventPayload(
  title: string,
  note: string | null,
): CreateEventRequest | null {
  if (!validateEventTitle(title)) return null;
  const trimmedNote = (note ?? "").trim();
  return {
    title: title.trim(),
    note: trimmedNote === "" ? null : trimmedNote,
  };
}

/** Rename patch (title-only, web parity), or null while blank. */
export function buildRenameEventPayload(
  title: string,
): UpdateEventRequest | null {
  if (!validateEventTitle(title)) return null;
  return { title: title.trim() };
}

/** This month's recorded total + count per event, grouped in one pass.
 * Forecast rows never enter: events collect recorded خرج‌ها only. */
function totalByEventId(
  expenses: readonly EventLedgerExpenseLike[],
): Record<string, { totalToman: number; count: number }> {
  const totals: Record<string, { totalToman: number; count: number }> = {};
  for (const e of expenses) {
    if (e.eventId === null) continue;
    const slot = totals[e.eventId] ?? { totalToman: 0, count: 0 };
    slot.totalToman += e.amountToman;
    slot.count += 1;
    totals[e.eventId] = slot;
  }
  return totals;
}

// --- persistence over the typed client ----------------------------------------

export interface EventWriteClient {
  events: {
    create(input: CreateEventRequest): Promise<unknown>;
    update(id: string, patch: UpdateEventRequest): Promise<unknown>;
    remove(id: string): Promise<void>;
  };
}

export async function createEvent<Out>(
  client: EventWriteClient,
  args: { title: string; note: string | null },
): Promise<Out> {
  const payload = buildCreateEventPayload(args.title, args.note);
  if (!payload) throw new Error("invalid event title");
  return (await client.events.create(payload)) as Out;
}

export async function renameEvent<Out>(
  client: EventWriteClient,
  id: string,
  title: string,
): Promise<Out> {
  const patch = buildRenameEventPayload(title);
  if (!patch) throw new Error("invalid event title");
  return (await client.events.update(id, patch)) as Out;
}

/** Unlink-only deletion (web parity): one DELETE on the event endpoint —
 * the server unlinks expenses (they keep category + month) and the core
 * never touches an expense row for a delete. */
export async function removeEvent(
  client: EventWriteClient,
  id: string,
): Promise<void> {
  await client.events.remove(id);
}

// --- detail -------------------------------------------------------------------

export interface EventDetailPanel<E> {
  event: EventLike;
  totalToman: number;
  count: number;
  expenses: E[];
  isEmpty: boolean;
  /** The locked-event add keeps context: the sheet opens on this id. */
  lockedEventId: string;
}

/** This event's panel: its month total plus only its own rows — each row
 * keeps its own category and occurrence month (the event never replaces
 * them). Unknown ids throw — never a stranger's panel. */
export function buildEventDetail<E extends EventLedgerExpenseLike>(args: {
  eventId: string;
  events: readonly EventLike[];
  expenses: readonly E[];
}): EventDetailPanel<E> {
  const event = args.events.find((e) => e.id === args.eventId);
  if (!event) throw new Error("unknown event");
  const expenses = args.expenses.filter((e) => e.eventId === event.id);
  const { totalToman, count } = totalByEventId(args.expenses)[event.id] ?? {
    totalToman: 0,
    count: 0,
  };
  return {
    event,
    totalToman,
    count,
    expenses,
    isEmpty: expenses.length === 0,
    lockedEventId: event.id,
  };
}
