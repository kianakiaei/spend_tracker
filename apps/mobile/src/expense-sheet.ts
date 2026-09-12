// Expense sheet core (expo-mobile ticket 03).
//
// The native Expense bottom sheet for create/edit/save-and-new/delete with
// the suggestion badge and quantity/unit support. Pure: no React, no Expo —
// the form component owns the stateful parts around these helpers, and the
// persistence functions below are thin wrappers over the typed v1 client
// (the single programmatic path to the frozen versioned API).
//
// Web parity (expense-sheet.tsx + sheet-helpers.ts + provider.tsx):
// - Title, whole-Toman amount, quantity + unit (عدد / کیلو), mandatory
//   occurrence date with the ledger month always derived from it, category,
//   and optional event.
// - The دسته پیشنهاد badge follows the classify answer until the user picks
//   a category by hand; edit rows and locked creates start manual.
// - A repeat-generated row wears its notice yet stays freely editable.
// - Delete asks inline confirm (a UI gate — the wire call needs no confirm).
// - Persian failure voice mirrors the web sheet so both surfaces speak one
//   language.

import {
  currentJalaliMonthKey,
  currentTehranISODate,
  fromISODate,
  fromJalaliMonthKey,
  jalaliMonthKey,
  toEnglishDigits,
  toISODate,
} from "@spend-tracker/shared/jalali";
import type {
  ClassifyDto,
  CreateExpenseRequest,
  UpdateExpenseRequest,
} from "@spend-tracker/shared/schemas/api";
import type { ExpenseUnit } from "@spend-tracker/shared/schemas/domain";

export type { ExpenseUnit };

/** Persian voice, mirroring the web expense sheet. */
export const EXPENSE_SHEET_MESSAGES = {
  saveFailed: "ذخیره نشد؛ دوباره تلاش کنید.",
  deleteFailed: "حذف نشد؛ دوباره تلاش کنید.",
  deleteConfirm: "این خرج حذف شود؟",
  fromTemplate: "این خرج از الگو تولید شده؛ ویرایشش الگو را عوض نمی‌کند.",
} as const;

// --- field parsing (verbatim parity with the web sheet-helpers) ---

/** Raw amount field text → positive integer tomans, or null while it is not
 * one yet (empty, separators-only, zero). Any digit script and any typed
 * separators are accepted. */
export function parseAmountInput(raw: string): number | null {
  const digits = toEnglishDigits(raw).replace(/\D+/g, "");
  if (digits === "") return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Raw quantity field text → positive number with up to 3 decimals (0.5
 * kilo), or null while empty/invalid. Empty means 1 (the default) at save
 * time. */
export function parseQuantityInput(raw: string): number | null {
  const normalized = toEnglishDigits(raw)
    .trim()
    .replace(/[٬,\s]/g, "");
  if (normalized === "") return null;
  // Decimal mark: Latin dot or the Arabic decimal separator (U+066B).
  const dotted = normalized.replace(/٫/g, ".");
  if (!/^\d+(\.\d{1,3})?$/.test(dotted)) return null;
  const value = Number(dotted);
  if (!Number.isFinite(value) || value > 1_000_000 || value <= 0) return null;
  return value;
}

/** The Jalali month a save will land in: always the picked date's month. */
export function effectiveMonthKey(date: string): string {
  return jalaliMonthKey(fromISODate(date));
}

/** Create-form date default: today in the current Jalali month, otherwise
 * the first day of the month the form was opened in. */
export function defaultCreateDate(
  formMonthKey: string,
  now: Date = new Date(),
): string {
  if (formMonthKey === currentJalaliMonthKey(now)) {
    return currentTehranISODate(now);
  }
  return toISODate(fromJalaliMonthKey(formMonthKey));
}

// --- form state + validation ---

export interface ExpenseFormState {
  title: string;
  amountRaw: string;
  quantityRaw: string;
  unit: ExpenseUnit;
  /** Mandatory Gregorian date-only string — there is no undated expense. */
  occurredAt: string;
  categoryId: string;
  eventId: string | null;
}

export interface ValidatedExpenseForm {
  amount: number | null;
  quantity: number;
  quantityValid: boolean;
  dateValid: boolean;
  canSave: boolean;
}

const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function validateExpenseForm(state: ExpenseFormState): ValidatedExpenseForm {
  const amount = parseAmountInput(state.amountRaw);
  const quantityParsed = parseQuantityInput(state.quantityRaw);
  const quantity = quantityParsed ?? 1;
  const quantityValid =
    state.quantityRaw.trim() === "" ||
    (quantityParsed !== null &&
      (state.unit === "kg" || Number.isInteger(quantityParsed)));
  const dateValid =
    DATE_ONLY.test(state.occurredAt) && isRealCalendarDate(state.occurredAt);
  const canSave =
    state.title.trim() !== "" &&
    amount !== null &&
    quantityValid &&
    dateValid &&
    state.categoryId.trim() !== "";
  return { amount, quantity, quantityValid, dateValid, canSave };
}

function isRealCalendarDate(iso: string): boolean {
  try {
    return toISODate(fromISODate(iso)) === iso;
  } catch {
    return false;
  }
}

/** Full create payload, or null while the form cannot save yet. */
export function buildCreatePayload(
  state: ExpenseFormState,
): CreateExpenseRequest | null {
  const checked = validateExpenseForm(state);
  if (!checked.canSave || checked.amount === null) return null;
  return {
    amountToman: checked.amount,
    quantity: checked.quantity,
    unit: state.unit,
    title: state.title.trim(),
    categoryId: state.categoryId,
    occurredAt: state.occurredAt,
    eventId: state.eventId,
  };
}

/** Full update patch (the server accepts partials; the sheet sends the
 * edited row, omitting an unchanged date so the row cannot drift months). */
export function buildUpdatePayload(
  state: ExpenseFormState,
  original: { occurredAt: string },
): UpdateExpenseRequest | null {
  const created = buildCreatePayload(state);
  if (!created) return null;
  if (created.occurredAt === original.occurredAt) {
    const patch: UpdateExpenseRequest = { ...created };
    delete patch.occurredAt;
    return patch;
  }
  return { ...created };
}

/** Ledger months touched by a save: one when the date stays, both when an
 * edit moves the row across a month boundary. */
export function affectedMonthsForSave(
  previousOccurredAt: string | null,
  nextOccurredAt: string,
): string[] {
  const next = effectiveMonthKey(nextOccurredAt);
  if (previousOccurredAt === null || previousOccurredAt === nextOccurredAt)
    return [next];
  const previous = effectiveMonthKey(previousOccurredAt);
  return previous === next ? [next] : [previous, next];
}

// --- suggestion badge + locked entry points ---

export interface SheetCategoryLike {
  id: string;
}

/** The chip follows the classify answer until the user picks by hand. */
export function shouldShowSuggestionBadge(manual: boolean): boolean {
  return !manual;
}

export function resolveActiveCategoryId(args: {
  manual: boolean;
  pickedId: string | null;
  suggestionCategoryId: string | null;
  categories: SheetCategoryLike[];
  fallbackCategoryId?: string;
}): string {
  if (args.manual && args.pickedId !== null) return args.pickedId;
  if (!args.manual && args.suggestionCategoryId !== null)
    return args.suggestionCategoryId;
  return (
    args.pickedId ??
    args.fallbackCategoryId ??
    args.categories[0]?.id ??
    ""
  );
}

/** A hand pick wins and silences the suggestion engine for the rest of the
 * form (the badge drops). */
export function pickSheetCategory(categoryId: string): {
  manual: boolean;
  pickedId: string;
} {
  return { manual: true, pickedId: categoryId };
}

export interface SheetExpenseRef {
  id: string;
  title: string;
  amountToman: number;
  quantity: number;
  unit: ExpenseUnit;
  occurredAt: string;
  categoryId: string;
  eventId: string | null;
  sourceRecurringId: string | null;
}

export type SheetOpen =
  | { mode: "create"; lockedCategoryId?: string; lockedEventId?: string }
  | { mode: "edit"; expense: SheetExpenseRef };

export interface SheetFormState {
  form: ExpenseFormState;
  /** Manual from the start when the category is a fact (edit row or locked
   * create) — the suggestion engine stays silent and the badge hides. */
  manual: boolean;
  pickedId: string | null;
}

/** Initial form for any entry point: plain create, locked create from a
 * category drilldown / event detail, or edit of a ledger row. */
export function createSheetFormState(
  open: SheetOpen,
  categories: SheetCategoryLike[],
  monthKey: string,
  now: Date = new Date(),
): SheetFormState {
  if (open.mode === "edit") {
    const row = open.expense;
    return {
      form: {
        title: row.title,
        amountRaw: String(row.amountToman),
        quantityRaw: String(row.quantity),
        unit: row.unit,
        occurredAt: row.occurredAt,
        categoryId: row.categoryId,
        eventId: row.eventId,
      },
      manual: true,
      pickedId: row.categoryId,
    };
  }
  const lockedCategoryId = open.lockedCategoryId;
  const lockedEventId = open.lockedEventId;
  const categoryId = lockedCategoryId ?? categories[0]?.id ?? "";
  return {
    form: {
      title: "",
      amountRaw: "",
      quantityRaw: "",
      unit: "piece",
      occurredAt: defaultCreateDate(monthKey, now),
      categoryId,
      eventId: lockedEventId ?? null,
    },
    manual: lockedCategoryId !== undefined,
    pickedId: lockedCategoryId ?? null,
  };
}

/** A repeat-generated row is independent yet freely editable — the notice. */
export function repeatNoticeFor(expense: {
  sourceRecurringId: string | null;
}): boolean {
  return expense.sourceRecurringId !== null;
}

// --- persistence over the typed client ---

export interface ClassifyClient {
  classify(input: { title: string }): Promise<ClassifyDto>;
}

export interface ExpenseWriteClient {
  expenses: {
    create(input: CreateExpenseRequest): Promise<unknown>;
    update(id: string, patch: UpdateExpenseRequest): Promise<unknown>;
    remove(id: string): Promise<void>;
  };
}

/** Classification lookup on title blur: side-effect-free suggestion.
 * Empty titles never hit the network; failures surface as "no suggestion"
 * (the save still works through the fallback category). */
export async function fetchSuggestion(
  client: ClassifyClient,
  title: string,
): Promise<ClassifyDto | null> {
  if (title.trim() === "") return null;
  try {
    return await client.classify({ title: title.trim() });
  } catch {
    return null;
  }
}

export async function saveSheetCreate<Out>(
  client: { expenses: { create(input: CreateExpenseRequest): Promise<Out> } },
  state: ExpenseFormState,
): Promise<Out> {
  const payload = buildCreatePayload(state);
  if (!payload) throw new Error("invalid expense form");
  return client.expenses.create(payload);
}

export async function saveSheetUpdate<Out>(
  client: {
    expenses: { update(id: string, patch: UpdateExpenseRequest): Promise<Out> };
  },
  id: string,
  patch: UpdateExpenseRequest,
): Promise<Out> {
  return client.expenses.update(id, patch);
}

export async function deleteSheetExpense(
  client: ExpenseWriteClient,
  id: string,
): Promise<void> {
  await client.expenses.remove(id);
}
