// Recurring template core (expo-mobile ticket 05).
//
// Template management with pause/resume, jump to the generated expense of
// the month, three-month future preview, and the Template bottom sheet for
// create/edit. Pure: no React, no Expo, no fetch — the Expo screens feed it
// DTOs from the typed v1 client and render what comes back.
//
// Web parity (templates/page.tsx + templates-manager.tsx):
// - The preview horizon is the next three Jalali months; empty months drop
//   out of the section list.
// - Each row reads its rhythm («هر ماه، روز …») with the end month only
//   while the template has one; a paused row wears the «متوقف» badge.
// - «خرج این ماه تولید شد» appears only while this month's ledger carries
//   the template's generated expense (decision 14's lazy generation).
// - Pause/resume is one `active` PATCH; create/edit send the full payload —
//   the server validates the final start/end pair and TEACHES the engine on
//   save (decision 06), so the sheet needs no learned-key logic.
// - Backfill and day-clamping stay server business: months past the start
//   date materialize on save and long days cling to the short month's end —
//   the sheet only says so in its description.
//
// Frozen-API note (spec: no new endpoints): every read below is a frozen v1
// call (recurring-templates list/preview, expenses listByMonth, categories
// list); the 3-month fan-out lives in template-queries.ts.

import {
  formatJalali,
  formatToman,
  fromISODate,
  shiftJalaliMonthKey,
  jalaliMonthKeyLabel,
  toEnglishDigits,
  toISODate,
  toPersianDigits,
} from "@spend-tracker/shared/jalali";
import type {
  CreateTemplateRequest,
  ForecastRowDto,
  UpdateTemplateRequest,
} from "@spend-tracker/shared/schemas/api";

/** The horizon the preview shows: the next three Jalali months (web parity). */
export const PREVIEW_MONTHS = 3;

/** Persian voice, mirroring the web templates surface. */
export const TEMPLATE_MESSAGES = {
  saveFailed: "انجام نشد؛ دوباره تلاش کنید.",
  emptyList: "الگویی برای تولید خودکار خرج ماهانه نساخته‌ای.",
  sheetDescription:
    "هر ماه، یک بار خرج می‌سازد — ماه‌های گذشته از تاریخ شروع هم با ذخیره ساخته می‌شوند؛ روزهای بلندِ ماه‌های کوتاه به آخر ماه می‌چسبند.",
  generatedJump: "خرج این ماه تولید شد",
} as const;

export interface TemplateLike {
  id: string;
  title: string;
  amountToman: number;
  categoryId: string;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  active: boolean;
}

export interface GeneratedExpenseLike {
  id: string;
  sourceRecurringId: string | null;
}

/** The next three Jalali month keys after the current one. */
export function previewMonthKeys(currentMonthKey: string): string[] {
  return Array.from({ length: PREVIEW_MONTHS }, (_, index) =>
    shiftJalaliMonthKey(currentMonthKey, index + 1),
  );
}

/** templateId → expenseId for templates that generated a ledger expense —
 * the jump map. Manual rows (null source) never enter it. */
export function buildGeneratedThisMonth(
  expenses: readonly GeneratedExpenseLike[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const expense of expenses) {
    if (expense.sourceRecurringId !== null) {
      map[expense.sourceRecurringId] = expense.id;
    }
  }
  return map;
}

export interface TemplateRow extends TemplateLike {
  /** The «متوقف» badge — null while the template is active. */
  stateBadge: "متوقف" | null;
  /** This month's generated expense, or null while none exists yet. */
  generatedExpenseId: string | null;
}

/** The list in server order, each row with its badge and jump state. */
export function buildTemplateListViewModel(args: {
  templates: readonly TemplateLike[];
  generatedThisMonth: Record<string, string>;
}): { rows: TemplateRow[] } {
  const rows: TemplateRow[] = args.templates.map((t) => ({
    ...t,
    stateBadge: t.active ? null : "متوقف",
    generatedExpenseId: args.generatedThisMonth[t.id] ?? null,
  }));
  return { rows };
}

/** The pause button's verb for the row's current state. */
export function pauseLabelFor(row: Pick<TemplateRow, "active">): string {
  return row.active ? "توقف" : "ازسرگیری";
}

/** «{toman} · هر ماه، روز {fa-day}» plus the end month while one exists. */
export function rhythmLabelFor(
  row: Pick<TemplateRow, "amountToman" | "dayOfMonth" | "endDate">,
): string {
  const base = `${formatToman(row.amountToman)} · هر ماه، روز ${toPersianDigits(row.dayOfMonth)}`;
  if (row.endDate === null) return base;
  return `${base} · تا ${formatJalali(fromISODate(row.endDate), "MMMM yyyy")}`;
}

export interface TemplatePreviewSection {
  monthKey: string;
  monthLabel: string;
  rows: ForecastRowDto[];
}

/** Preview sections for the horizon months that carry forecast rows —
 * clamping already happened server-side (`day` is the Jalali day). Only the
 * three months after the current one surface, in horizon order — a stale or
 * out-of-window preview never renders as an estimate. */
export function buildTemplatePreviewSections(args: {
  currentMonthKey: string;
  previews: ReadonlyArray<{ monthKey: string; rows: ForecastRowDto[] }>;
}): TemplatePreviewSection[] {
  const horizon = new Set(previewMonthKeys(args.currentMonthKey));
  return args.previews
    .filter((preview) => horizon.has(preview.monthKey) && preview.rows.length > 0)
    .sort((a, b) => (a.monthKey < b.monthKey ? -1 : a.monthKey > b.monthKey ? 1 : 0))
    .map((preview) => ({
      monthKey: preview.monthKey,
      monthLabel: jalaliMonthKeyLabel(preview.monthKey),
      rows: [...preview.rows],
    }));
}

// --- sheet field parsing (web parity with a friendlier day field) ---

/** 1..31 as the sheet understands it — null while the field is not a legal
 * day. The web day field is type=number; mobile also accepts Persian digits
 * before the same 1..31 gate. */
export function parseTemplateDay(raw: string): number | null {
  const value = Number(toEnglishDigits(raw).trim());
  return Number.isInteger(value) && value >= 1 && value <= 31 ? value : null;
}

/** Raw amount field text → positive integer tomans, or null while it is not
 * one yet (empty, separators-only, zero). Same semantics as the expense
 * sheet's parser: any digit script and any typed separators are accepted. */
export function parseTemplateAmount(raw: string): number | null {
  const digits = toEnglishDigits(raw).replace(/\D+/g, "");
  if (digits === "") return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

// --- sheet form state + validation ---

export interface TemplateFormState {
  title: string;
  amountRaw: string;
  dayRaw: string;
  categoryId: string;
  /** Mandatory Gregorian date-only start. */
  startDate: string;
  /** Optional Gregorian date-only end — null means open-ended. */
  endDate: string | null;
}

export interface ValidatedTemplateForm {
  amount: number | null;
  day: number | null;
  dateValid: boolean;
  /** The final start/end pair holds (open-ended or end ≥ start). */
  windowValid: boolean;
  canSave: boolean;
}

const DATE_ONLY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isRealCalendarDate(iso: string): boolean {
  try {
    return toISODate(fromISODate(iso)) === iso;
  } catch {
    return false;
  }
}

export function validateTemplateForm(
  state: TemplateFormState,
): ValidatedTemplateForm {
  const amount = parseTemplateAmount(state.amountRaw);
  const day = parseTemplateDay(state.dayRaw);
  const startValid =
    DATE_ONLY.test(state.startDate) && isRealCalendarDate(state.startDate);
  const endValid =
    state.endDate === null ||
    (DATE_ONLY.test(state.endDate) && isRealCalendarDate(state.endDate));
  const dateValid = startValid && endValid;
  // The window validates on the final pair (web parity: the server re-checks
  // the merged start/end on edit).
  const windowValid =
    dateValid &&
    (state.endDate === null || state.endDate >= state.startDate);
  const canSave =
    state.title.trim() !== "" &&
    amount !== null &&
    day !== null &&
    state.categoryId.trim() !== "" &&
    windowValid;
  return { amount, day, dateValid, windowValid, canSave };
}

/** Full create payload, or null while the form cannot save yet. */
export function buildCreateTemplatePayload(
  state: TemplateFormState,
): CreateTemplateRequest | null {
  const checked = validateTemplateForm(state);
  if (!checked.canSave || checked.amount === null || checked.day === null)
    return null;
  return {
    amountToman: checked.amount,
    title: state.title.trim(),
    categoryId: state.categoryId,
    dayOfMonth: checked.day,
    startDate: state.startDate,
    endDate: state.endDate,
  };
}

/** Full update payload — the web sheet sends the edited template whole and
 * the server validates the final pair, so edit and create share one shape. */
export function buildUpdateTemplatePayload(
  state: TemplateFormState,
): UpdateTemplateRequest | null {
  const created = buildCreateTemplatePayload(state);
  if (!created) return null;
  return { ...created };
}

// --- persistence over the typed client ---

export interface TemplateWriteClient {
  recurringTemplates: {
    create(input: CreateTemplateRequest): Promise<unknown>;
    update(id: string, patch: UpdateTemplateRequest): Promise<unknown>;
  };
}

export async function createTemplate<Out>(
  client: TemplateWriteClient,
  state: TemplateFormState,
): Promise<Out> {
  const payload = buildCreateTemplatePayload(state);
  if (!payload) throw new Error("invalid template form");
  return (await client.recurringTemplates.create(payload)) as Out;
}

export async function saveTemplateUpdate<Out>(
  client: TemplateWriteClient,
  id: string,
  state: TemplateFormState,
): Promise<Out> {
  const payload = buildUpdateTemplatePayload(state);
  if (!payload) throw new Error("invalid template form");
  return (await client.recurringTemplates.update(id, payload)) as Out;
}

/** Pause/resume through one `active` PATCH — the list's only partial write. */
export async function toggleTemplateActive<Out>(
  client: TemplateWriteClient,
  template: Pick<TemplateLike, "id" | "active">,
): Promise<Out> {
  return (await client.recurringTemplates.update(template.id, {
    active: !template.active,
  })) as Out;
}
