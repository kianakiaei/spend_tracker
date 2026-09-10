"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createSuggestionEngine } from "@/lib/categorization/suggestion-engine";
import type {
  ClientSuggestionEngine,
} from "@/lib/categorization/suggestion-engine";
import type { Category } from "@/lib/services";
import type { ExpenseUnit } from "@/lib/schemas";
import type { LearnedKeyRecord } from "@/lib/categorization";
import { ExpenseSheet } from "./expense-sheet";

// The expense-sheet seam (ticket 27): one client island around the server
// dashboard. Server components stay server — the ledger's rows call
// useExpenseSheet() directly — while the open state, the in-memory
// suggestion engine and the dialog itself live here. The engine is rebuilt
// from fresh props on every RSC render; router.refresh() after each save is
// what carries the new learned counters in (learning happens server-side on
// save, ticket 06).

/** The fields the sheet needs from an expense row — ExpenseWithCategory
 * satisfies it structurally, so the ledger passes its rows as-is. */
export interface SheetExpense {
  id: string;
  title: string;
  amountToman: number;
  quantity: number;
  unit: ExpenseUnit;
  occurredAt: string | null;
  monthKey: string;
  categoryId: string;
  sourceRecurringId: string | null;
}

export type SheetOpen =
  | { mode: "create" }
  /** The drilldown's «افزودن به این دسته» (ticket 28): record with the
   * category fixed — no picker, no suggestion engine. */
  | { mode: "create"; lockedCategoryId: string }
  | { mode: "edit"; expense: SheetExpense };

interface ExpenseSheetContextValue {
  /** Without an id: the dashboard's suggestion-driven record flow. With
   * one: the locked create of a category drilldown. */
  openCreate: (lockedCategoryId?: string) => void;
  openEdit: (expense: SheetExpense) => void;
}

const ExpenseSheetContext = createContext<ExpenseSheetContextValue | null>(
  null,
);

export function useExpenseSheet(): ExpenseSheetContextValue {
  const ctx = useContext(ExpenseSheetContext);
  if (!ctx) {
    throw new Error("useExpenseSheet must be used inside ExpenseSheetProvider");
  }
  return ctx;
}

/** The URL parameter of the dashboard's expense deep-link (ticket 28: the
 * templates page's «خرج این ماه تولید شد» lands here). */
const EXPENSE_PARAM = "expense";

export function ExpenseSheetProvider({
  monthKey,
  categories,
  learnedKeys,
  fallbackCategoryId,
  initialExpense,
  children,
}: {
  monthKey: string;
  categories: Category[];
  learnedKeys: LearnedKeyRecord[];
  fallbackCategoryId: string;
  /** A ?expense= deep-link opens that row's edit sheet once, then strips
   * itself from the address so a refresh doesn't resurrect it. */
  initialExpense?: SheetExpense;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<SheetOpen | null>(() =>
    initialExpense ? { mode: "edit", expense: initialExpense } : null,
  );

  useEffect(() => {
    if (initialExpense === undefined) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(EXPENSE_PARAM);
    window.history.replaceState(null, "", url.toString());
    // Once on mount — the sheet state owns it from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const engine = useMemo<ClientSuggestionEngine>(
    () =>
      createSuggestionEngine({
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        })),
        learnedKeys,
        fallbackCategoryId,
      }),
    [categories, learnedKeys, fallbackCategoryId],
  );

  const value = useMemo<ExpenseSheetContextValue>(
    () => ({
      openCreate: (lockedCategoryId?: string) =>
        setOpen(
          lockedCategoryId === undefined
            ? { mode: "create" }
            : { mode: "create", lockedCategoryId },
        ),
      openEdit: (expense) => setOpen({ mode: "edit", expense }),
    }),
    [],
  );

  return (
    <ExpenseSheetContext.Provider value={value}>
      {children}
      {open && (
        <ExpenseSheet
          open={open}
          onClose={() => setOpen(null)}
          monthKey={monthKey}
          categories={categories}
          engine={engine}
        />
      )}
    </ExpenseSheetContext.Provider>
  );
}

/** The sheet's trigger — the one jade circle of the dashboard (prototype v2:
 * fixed bottom, inline end). */
export function AddExpenseFab() {
  const { openCreate } = useExpenseSheet();
  return (
    <button
      type="button"
      onClick={() => openCreate()}
      aria-label="ثبت خرج"
      className="fixed bottom-6 end-6 z-30 grid size-14 place-items-center rounded-full bg-accent text-[27px] font-light leading-none text-white shadow-[0_12px_26px_rgba(26,122,92,0.35)] hover:brightness-110"
    >
      +
    </button>
  );
}
