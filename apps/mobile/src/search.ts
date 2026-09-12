// Whole-ledger search core (expo-mobile ticket 07).
//
// Title search with the same Persian normalization the categorization engine
// uses, hit metadata (amount, Jalali occurrence month, category), and
// tap-to-edit in the shared Expense sheet. Pure: no React, no Expo, no
// fetch — the Expo screen feeds it DTOs from the typed v1 client and renders
// what comes back.
//
// Web parity (search/page.tsx + search-board.tsx):
// - The query and every title pass through the shared canonical form, so
//   «شير» still matches «شیر», Persian digits match Latin ones, and ZWNJ
//   vanishes. The server applies the same rule to the fetched page; the board
//   narrows live as the user types (narrowHits mirrors that client filter so
//   the list stays consistent between debounced fetches).
// - Each hit shows مبلغ، ماهِ جلالی وقوع and دسته (plus the رویداد title
//   when attached); tapping a hit opens the same Expense edit sheet as the
//   home ledger (toSheetExpenseRef mirrors the board's toSheetExpense).
// - Empty states speak the board's voice verbatim.
//
// Frozen-API note (spec: no new endpoints): mobile queries the frozen
// GET /api/v1/search?q= (see search-queries.ts). The web page reads the
// expense service directly (listAll); the frozen API exposes no listAll read,
// so a blank query short-circuits to [] client-side — exactly what the
// server answers for blank q — without touching the wire.

import {
  formatJalali,
  formatToman,
  fromISODate,
  jalaliMonthKeyLabel,
} from "@spend-tracker/shared/jalali";
import { canonical } from "@spend-tracker/shared/normalize";
import type { SearchResultDto } from "@spend-tracker/shared/schemas/api";
import type { SheetExpenseRef } from "./expense-sheet";

/** Persian voice, mirroring the web search board verbatim. */
export const SEARCH_MESSAGES = {
  /** Blank query: the board invites typing, it does not claim «no results». */
  emptyQuery: "برای جست‌وجو، بخشی از عنوان را بنویس.",
  noHits: "خرجی با این عنوان پیدا نشد.",
  loadFailed: "ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.",
} as const;

export type SearchHit = Pick<
  SearchResultDto,
  | "expenseId"
  | "title"
  | "amountToman"
  | "quantity"
  | "unit"
  | "monthKey"
  | "occurredAt"
  | "categoryName"
  | "categoryId"
  | "eventTitle"
  | "eventId"
  | "sourceRecurringId"
>;

/** The board's live narrowing: blank shows everything fetched, otherwise the
 * shared canonical substring — the same rule the server applied. */
export function narrowHits<T extends Pick<SearchHit, "title">>(
  hits: readonly T[],
  query: string,
): T[] {
  const needle = canonical(query);
  if (needle === "") return [...hits];
  return hits.filter((hit) => canonical(hit.title).includes(needle));
}

export interface SearchRow {
  expenseId: string;
  title: string;
  amountLabel: string;
  monthLabel: string;
  /** The hit's own وقوع month — the edit sheet opens on this month. */
  monthKey: string;
  occurredLabel: string;
  categoryName: string;
  eventTitle: string | null;
  editRef: SheetExpenseRef;
}

/** One row per hit: مبلغ + ماهِ جلالی وقوع + دسته, each pre-formatted with
 * Persian digits so the screen renders rows directly. */
export function buildSearchViewModel(args: {
  hits: readonly SearchHit[];
}): { rows: SearchRow[] } {
  return {
    rows: args.hits.map((hit) => ({
      expenseId: hit.expenseId,
      title: hit.title,
      amountLabel: formatToman(hit.amountToman),
      monthLabel: jalaliMonthKeyLabel(hit.monthKey),
      monthKey: hit.monthKey,
      occurredLabel: formatJalali(fromISODate(hit.occurredAt), "d MMMM yyyy"),
      categoryName: hit.categoryName,
      eventTitle: hit.eventTitle,
      editRef: toSheetExpenseRef(hit),
    })),
  };
}

/** A hit opens the shared Expense edit sheet (web toSheetExpense parity):
 * every web field rides along, so fix-from-search edits the real خرج. */
export function toSheetExpenseRef(hit: SearchHit): SheetExpenseRef {
  return {
    id: hit.expenseId,
    title: hit.title,
    amountToman: hit.amountToman,
    quantity: hit.quantity,
    unit: hit.unit,
    occurredAt: hit.occurredAt,
    categoryId: hit.categoryId,
    eventId: hit.eventId,
    sourceRecurringId: hit.sourceRecurringId,
  };
}
