// Category management core (expo-mobile ticket 04).
//
// Full category management with usage counts, creation with color, rename
// including system categories, reordering, guarded deletion via
// move-expenses, and the drilldown with locked-category expense entry.
// Pure: no React, no Expo, no fetch — the Expo screens feed it DTOs from the
// typed v1 client and render what comes back.
//
// Web parity (categories/page.tsx + categories-manager.tsx +
// categories/[id]/page.tsx + category-drilldown.tsx):
// - Rows sort by display `order`; each links to its stack drilldown.
// - System rows are labelled «دستهٔ سیستمی» and refuse deletion; their
//   rename stays free.
// - A custom row with expenses gets a disabled delete plus the «انتقال همهٔ
//   خرج‌ها» shortcut (move, then delete the emptied category — decision 05).
// - A row pointed at by a recurring template has NO shortcut — the move API
//   carries expenses only, so the template must be re-pointed first and a
//   delete would 409 after the move.
// - Reorder swaps `order` with the neighbor through two PATCHes; the local
//   swap happens only after both land, so a failure never leaves the list
//   lying.
// - The drilldown panel carries this category's month total plus only its
//   own rows; the composite «ثبت‌شده + پیش‌بینی» note appears only for a
//   future month with forecast rows (decision 15).
//
// Frozen-API note (spec: no new endpoints): the web page reads all-time
// expense counts from a GROUP-BY service the API does not expose, so mobile
// shows per-month خرج counts from the month summary plus all-time الگو
// counts grouped from the templates list.

import { toPersianDigits } from "@spend-tracker/shared/jalali";
import type {
  CreateCategoryRequest,
  MoveExpensesDto,
  UpdateCategoryRequest,
} from "@spend-tracker/shared/schemas/api";

export interface CategoryLike {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  kind: "system" | "custom";
  order: number;
}

export interface CategorySwatch {
  hex: string;
  name: string;
}

/** Same hues as the web palette (category-palette.ts) — duplicated here so
 * the mobile core stays free of web-only imports; one list, same family. */
export const MOBILE_CATEGORY_SWATCHES: readonly CategorySwatch[] = [
  { hex: "#1a7a5c", name: "یشمی" },
  { hex: "#3da3c4", name: "فیروزه‌ای" },
  { hex: "#3d7fc4", name: "آبی" },
  { hex: "#7a5fc4", name: "بنفش" },
  { hex: "#c4559b", name: "سرخابی" },
  { hex: "#c47a3d", name: "نارنجی" },
  { hex: "#b3402e", name: "آجری" },
  { hex: "#82887e", name: "خاکستری" },
  { hex: "#d9a521", name: "خردلی" },
  { hex: "#65a30d", name: "لیمویی" },
  { hex: "#33477a", name: "نیلی" },
  { hex: "#8a5a2b", name: "قهوه‌ای" },
  { hex: "#0d9488", name: "سبزآبی" },
];

/** Persian voice, mirroring the web manager's generic failure line. */
export const CATEGORY_MESSAGES = {
  saveFailed: "انجام نشد؛ دوباره تلاش کنید.",
  reorderFailed: "ترتیب ذخیره نشد؛ دوباره تلاش می‌شود.",
  deleteConfirm: "این دسته حذف شود؟",
  systemHint: "دسته‌های سیستمی حذف نمی‌شوند؛ نام هر دسته آزادانه تغییر می‌کند.",
} as const;

/** «انتقال همهٔ خرج‌های {name} به…» — the move shortcut's title. */
export function moveTitleFor(name: string): string {
  return `انتقال همهٔ خرج‌های ${name} به…`;
}

export type CategoryDeleteState =
  | { kind: "allowed" }
  | { kind: "needs-move"; expenseCount: number }
  | { kind: "blocked-template"; templateCount: number }
  | { kind: "blocked-system" };

export interface CategoryRow extends CategoryLike {
  expenseCount: number;
  templateCount: number;
  usageLabel: string;
  deleteState: CategoryDeleteState;
  /** The guard's clear error, shown under guarded rows (null when deletable). */
  deleteHint: string | null;
  /** Stack drilldown pushed above the tabs (back keeps context). */
  drilldown: string;
}

function usageLabelFor(args: {
  kind: CategoryLike["kind"];
  expenseCount: number;
  templateCount: number;
}): string {
  if (args.kind === "system") return "دستهٔ سیستمی";
  // Counts are Persian digits (spec: reads like the web). The خرج count is
  // this month's — the frozen API exposes no all-time GROUP-BY read — so
  // the label says so and never claims an unprovable «خالی».
  const parts: string[] = [];
  parts.push(
    args.expenseCount > 0
      ? `${toPersianDigits(args.expenseCount)} خرج در این ماه`
      : "بدون خرج در این ماه",
  );
  if (args.templateCount > 0)
    parts.push(`${toPersianDigits(args.templateCount)} الگو`);
  return parts.join(" · ");
}

function deleteStateFor(args: {
  kind: CategoryLike["kind"];
  expenseCount: number;
  templateCount: number;
}): CategoryDeleteState {
  if (args.kind === "system") return { kind: "blocked-system" };
  if (args.templateCount > 0)
    return { kind: "blocked-template", templateCount: args.templateCount };
  if (args.expenseCount > 0)
    return { kind: "needs-move", expenseCount: args.expenseCount };
  return { kind: "allowed" };
}

/** The guard's clear error per state — the web manager's disabled titles in
 * mobile voice. A directly-deletable row has no hint. */
export function deleteHintFor(state: CategoryDeleteState): string | null {
  switch (state.kind) {
    case "allowed":
      return null;
    case "blocked-system":
      return "دستهٔ سیستمی حذف نمی‌شود";
    case "needs-move":
      return "دستهٔ پُر حذف نمی‌شود؛ اول خرج‌هایش را منتقل کنید";
    case "blocked-template":
      return "یک الگوی تکرار به این دسته اشاره می‌کند؛ اول دستهٔ الگو را عوض کنید";
  }
}

/** Rows in display order, each with its usage label, delete guard, and
 * drilldown link. */
export function buildCategoryListViewModel(args: {
  categories: CategoryLike[];
  expenseCounts: Record<string, number>;
  templateCounts: Record<string, number>;
}): { rows: CategoryRow[] } {
  const rows: CategoryRow[] = [...args.categories]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const expenseCount = args.expenseCounts[c.id] ?? 0;
      const templateCount = args.templateCounts[c.id] ?? 0;
      const deleteState = deleteStateFor({
        kind: c.kind,
        expenseCount,
        templateCount,
      });
      return {
        ...c,
        expenseCount,
        templateCount,
        usageLabel: usageLabelFor({
          kind: c.kind,
          expenseCount,
          templateCount,
        }),
        deleteState,
        deleteHint: deleteHintFor(deleteState),
        drilldown: `/category/${c.id}`,
      };
    });
  return { rows };
}

/** A name is usable when it holds a non-blank word after trimming. */
export function validateCategoryName(name: string): boolean {
  return name.trim() !== "";
}

/** Full create payload, or null while the name is blank. */
export function buildCreateCategoryPayload(
  name: string,
  color: string,
): CreateCategoryRequest | null {
  if (!validateCategoryName(name)) return null;
  return { name: name.trim(), color, icon: null };
}

/** Rename patch (free for system rows too), or null while blank. */
export function buildRenamePayload(
  name: string,
): UpdateCategoryRequest | null {
  if (!validateCategoryName(name)) return null;
  return { name: name.trim() };
}

export interface ReorderPlan {
  first: { id: string; order: number };
  second: { id: string; order: number };
}

/** The two PATCHes a reorder needs: this row takes the neighbor's order
 * and the neighbor takes this row's. Null past either end of the list. */
export function reorderPlan<T extends { id: string; order: number }>(
  rows: readonly T[],
  index: number,
  delta: -1 | 1,
): ReorderPlan | null {
  const row = rows[index];
  const neighbor = rows[index + delta];
  if (!row || !neighbor) return null;
  return {
    first: { id: row.id, order: neighbor.order },
    second: { id: neighbor.id, order: row.order },
  };
}

/** The local swap — call only after both PATCHes land, so a failed reorder
 * never leaves the list lying. The source rows are never mutated. */
export function applyReorderLocal<T>(rows: readonly T[], index: number, delta: -1 | 1): T[] {
  const neighbor = rows[index + delta];
  const row = rows[index];
  if (!row || !neighbor) return [...rows];
  const next = [...rows];
  next[index] = neighbor;
  next[index + delta] = row;
  return next;
}

/** All-time الگو counts grouped from the templates list (client-side — the
 * frozen API exposes no count endpoint). */
export function countTemplatesByCategory(
  templates: ReadonlyArray<{ categoryId: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of templates) counts[t.categoryId] = (counts[t.categoryId] ?? 0) + 1;
  return counts;
}

// --- persistence over the typed client ----------------------------------------

export interface CategoryWriteClient {
  categories: {
    create(input: CreateCategoryRequest): Promise<unknown>;
    update(id: string, patch: UpdateCategoryRequest): Promise<unknown>;
    remove(id: string): Promise<void>;
    moveExpenses(id: string, input: { targetCategoryId: string }): Promise<MoveExpensesDto>;
  };
}

export async function createCategory<Out>(
  client: CategoryWriteClient,
  args: { name: string; color: string },
): Promise<Out> {
  const payload = buildCreateCategoryPayload(args.name, args.color);
  if (!payload) throw new Error("invalid category name");
  return (await client.categories.create(payload)) as Out;
}

export async function renameCategory<Out>(
  client: CategoryWriteClient,
  id: string,
  name: string,
): Promise<Out> {
  const patch = buildRenamePayload(name);
  if (!patch) throw new Error("invalid category name");
  return (await client.categories.update(id, patch)) as Out;
}

export async function removeCategory(
  client: CategoryWriteClient,
  id: string,
): Promise<void> {
  await client.categories.remove(id);
}

/** Move every خرج to the target, then delete the emptied category — the
 * delete guard's shortcut. Move first (every expense preserved), delete
 * second. */
export async function moveCategoryExpensesThenRemove(
  client: CategoryWriteClient,
  id: string,
  targetCategoryId: string,
): Promise<MoveExpensesDto> {
  const result = await client.categories.moveExpenses(id, { targetCategoryId });
  await client.categories.remove(id);
  return result;
}

/** The two PATCHes of a reorder swap, in order. */
export async function reorderCategory(
  client: CategoryWriteClient,
  plan: ReorderPlan,
): Promise<void> {
  await client.categories.update(plan.first.id, { order: plan.first.order });
  await client.categories.update(plan.second.id, { order: plan.second.order });
}

// --- drilldown ---------------------------------------------------------------

export interface DrilldownExpenseLike {
  id: string;
  categoryId: string;
}

export interface DrilldownForecastLike {
  templateId: string;
  categoryId: string;
}

export interface DrilldownSummaryRow {
  categoryId: string;
  totalToman: number;
}

export interface DrilldownSummaryLike {
  byCategory: DrilldownSummaryRow[];
}

export interface CategoryDrilldownPanel {
  category: CategoryLike;
  totalToman: number;
  /** True only for a future month carrying forecast rows (decision 15). */
  hasForecast: boolean;
  expenses: DrilldownExpenseLike[];
  forecast: DrilldownForecastLike[];
  isEmpty: boolean;
  /** The locked-category add keeps context: the sheet opens on this id. */
  lockedCategoryId: string;
}

/** This category's panel: its month total plus only its own rows. Jalali
 * month keys sort lexicographically, so a plain string compare decides
 * past vs future. Forecast rows surface only for a future month — پیش‌بینی
 * is display-only for estimates (decision 15); the server previews the
 * same way, and the gate here keeps the panel honest even if the wire ever
 * carries rows for the current month. Unknown ids throw — never a
 * stranger's panel. */
export function buildCategoryDrilldown<
  C extends CategoryLike,
  E extends DrilldownExpenseLike,
  F extends DrilldownForecastLike,
>(args: {
  monthKey: string;
  currentMonthKey: string;
  categoryId: string;
  categories: readonly C[];
  summary: DrilldownSummaryLike;
  expenses: readonly E[];
  forecast: readonly F[];
}): CategoryDrilldownPanel & { category: C; expenses: E[]; forecast: F[] } {
  const category = args.categories.find((c) => c.id === args.categoryId);
  if (!category) throw new Error("unknown category");
  const isFuture = args.monthKey > args.currentMonthKey;
  const expenses = args.expenses.filter((e) => e.categoryId === category.id);
  const forecast = isFuture
    ? args.forecast.filter((f) => f.categoryId === category.id)
    : [];
  const totalToman =
    args.summary.byCategory.find((r) => r.categoryId === category.id)?.totalToman ?? 0;
  return {
    category,
    totalToman,
    hasForecast: forecast.length > 0,
    expenses,
    forecast,
    isEmpty: expenses.length === 0 && forecast.length === 0,
    lockedCategoryId: category.id,
  };
}
