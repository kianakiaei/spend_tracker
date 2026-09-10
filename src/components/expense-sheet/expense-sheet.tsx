"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-multi-date-picker";
// The OFFICIAL persian calendar + locale (research 04 — never `jalali`):
// the picker displays Jalali while the state stays a Gregorian date-only
// string.
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { CategoryDot } from "@/components/category-color";
import { Tag } from "@/components/tag";
import { SheetPanel } from "@/components/ui/sheet-panel";
import {
  BTN_GHOST,
  CHIP_CLASS,
  FIELD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  OPTION_CLASS,
  PICKER_INPUT_CLASS,
} from "@/components/ui/style";
import type { SuggestionAnswer } from "@/lib/categorization/suggestion-engine";
import type { ClientSuggestionEngine } from "@/lib/categorization/suggestion-engine";
import type { ExpenseUnit } from "@/lib/schemas";
import { api } from "@/lib/api/client";
import {
  currentTehranISODate,
  formatToman,
  fromISODate,
  fromJalaliMonthKey,
  jalaliMonthLabel,
  toISODate,
} from "@/lib/jalali";
import type { Category } from "@/lib/services";
import type { SheetOpen } from "./provider";
import {
  effectiveMonthKey,
  parseAmountInput,
  parseQuantityInput,
} from "./sheet-helpers";

// The record/edit bottom sheet (ticket 27), following the approved
// prototype-v2 anatomy: ink-ruled fields on a paper panel rising over a
// scrim; the category chip carrying the «پیشنهاد» badge while the engine
// still owns it; the jade ثبت against a quiet انصراف; delete (edit only)
// isolated on the other side with an inline confirm.
//
// The ticket-06 suggestion contract lives in the two flags below: the chip
// follows the debounced engine answer until the user picks a category by
// hand, then the engine goes silent for the rest of the form and the badge
// drops. Edit starts manual — the row's category is a fact, not a
// suggestion — and so does the drilldown's locked create (ticket 28),
// which additionally keeps the picker away entirely. Typing is
// side-effect-free: classification is the pure in-memory engine; the only
// network calls are the explicit save/delete.

const DEBOUNCE_MS = 150;

// Chip/button/field classes speak the shared ui/style vocabulary; the
// sheet's own additions stay local.

export function ExpenseSheet({
  open,
  onClose,
  monthKey,
  categories,
  engine,
}: {
  open: SheetOpen;
  onClose: () => void;
  monthKey: string;
  categories: Category[];
  engine: ClientSuggestionEngine;
}) {
  const router = useRouter();
  const isEdit = open.mode === "edit";
  const expense = isEdit ? open.expense : null;
  // The drilldown's locked create (ticket 28): the category is a fact the
  // page brought in, exactly like an edit row's category — the picker and
  // the engine stay away.
  const lockedCategory =
    open.mode === "create" && "lockedCategoryId" in open
      ? (categories.find((c) => c.id === open.lockedCategoryId) ?? null)
      : null;

  const [title, setTitle] = useState(expense?.title ?? "");
  const [amountRaw, setAmountRaw] = useState(
    expense ? String(expense.amountToman) : "",
  );
  const [quantityRaw, setQuantityRaw] = useState(
    expense ? String(expense.quantity) : "",
  );
  // Quantity unit (عدد | کیلو) — weighed goods take decimals, pieces stay
  // whole (enforced below, mirroring the server's unit rule).
  const [unit, setUnit] = useState<ExpenseUnit>(expense?.unit ?? "piece");
  // The date starts on today for a fresh record — but an edit opens
  // exactly what the row has: a dateless (undated) row opens dateless, so
  // saving its title/amount never drags it into another month (ticket 15:
  // clearing never moves — only picking a date does).
  const [date, setDate] = useState<string | null>(
    expense?.occurredAt ?? (isEdit ? null : currentTehranISODate()),
  );
  // Manual from the start when the category is a fact — an edit row's own
  // category or the drilldown's locked one (ticket 28).
  const [manual, setManual] = useState(isEdit || lockedCategory !== null);
  const [pickedId, setPickedId] = useState<string | null>(
    expense?.categoryId ?? lockedCategory?.id ?? null,
  );
  const [optsOpen, setOptsOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live suggestion (ticket 06): ~150ms after the last keystroke; silent
  // once the category is manual (an edit row or the drilldown's locked
  // category). The first answer classifies immediately so the sheet never
  // opens category-less.
  const [suggestion, setSuggestion] = useState<SuggestionAnswer | null>(() =>
    manual ? null : engine.classify(title),
  );
  useEffect(() => {
    if (manual) return;
    const timer = setTimeout(
      () => setSuggestion(engine.classify(title)),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [engine, manual, title]);

  const amount = parseAmountInput(amountRaw);
  const quantityParsed = parseQuantityInput(quantityRaw);
  const quantity = quantityParsed ?? 1;
  const unitPrice =
    amount !== null ? Math.round(amount / quantity) : null;
  const activeCategoryId =
    manual && pickedId !== null
      ? pickedId
      : suggestion !== null
        ? suggestion.categoryId
        : (pickedId ?? categories[0]?.id ?? "");
  const activeCategory =
    categories.find((c) => c.id === activeCategoryId) ?? categories[0];
  // The month this save will land in — the sheet's honest subtitle (a dated
  // expense always follows its own date, ticket 15).
  const targetMonthLabel = jalaliMonthLabel(
    fromJalaliMonthKey(effectiveMonthKey(date, monthKey, expense?.monthKey)),
  );
  const targetMonth = isEdit
    ? `ذخیره در ${targetMonthLabel}`
    : lockedCategory
      ? `ثبت در ${lockedCategory.name} — ${targetMonthLabel}`
      : `ثبت در ${targetMonthLabel}`;

  const quantityValid =
    quantityRaw.trim() === "" ||
    (quantityParsed !== null && (unit === "kg" || Number.isInteger(quantityParsed)));
  const canSave =
    title.trim() !== "" &&
    amount !== null &&
    quantityValid &&
    !pending;

  async function save() {
    if (pending || title.trim() === "" || amount === null || !quantityValid)
      return;
    setPending(true);
    setError(null);
    try {
      if (expense) {
        await api.expenses.update(expense.id, {
          amountToman: amount,
          quantity,
          unit,
          title: title.trim(),
          categoryId: activeCategoryId,
          occurredAt: date,
        });
      } else {
        await api.expenses.create({
          amountToman: amount,
          quantity,
          unit,
          title: title.trim(),
          categoryId: activeCategoryId,
          occurredAt: date,
          entryMonthKey: monthKey,
        });
      }
      onClose();
      // Fresh dashboard AND fresh learned counters — learning happened
      // server-side on this save (ticket 06).
      router.refresh();
    } catch {
      // Network/handler faults speak with one generic voice; every field
      // keeps exactly what the user typed (ticket 27).
      setError("ذخیره نشد؛ دوباره تلاش کنید.");
      setPending(false);
    }
  }

  async function remove() {
    if (!expense || pending) return;
    setPending(true);
    setError(null);
    try {
      await api.expenses.remove(expense.id);
      onClose();
      router.refresh();
    } catch {
      setError("حذف نشد؛ دوباره تلاش کنید.");
      setPending(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <SheetPanel onClose={onClose} labelledBy="expense-sheet-title">
      <h2 id="expense-sheet-title" className="text-[17px] font-bold">
        {isEdit ? "ویرایش خرج" : "ثبت خرج"}
      </h2>
        <p aria-live="polite" className="mt-0.5 text-[13px] text-ink-muted">
          {targetMonth}
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className={FIELD_CLASS}>
            <label htmlFor="expense-title" className={LABEL_CLASS}>
              عنوان
            </label>
            <input
              id="expense-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثلاً نان و شیر"
              autoFocus
              className={INPUT_CLASS}
            />
          </div>

          <div className={FIELD_CLASS}>
            <label htmlFor="expense-amount" className={LABEL_CLASS}>
              مبلغ
            </label>
            <input
              id="expense-amount"
              type="text"
              inputMode="numeric"
              value={amountRaw}
              onChange={(event) => setAmountRaw(event.target.value)}
              placeholder="به تومان"
              className={INPUT_CLASS}
            />
            <p aria-live="polite" className="mt-1.5 text-[12px] text-ink-muted">
              {amount !== null ? formatToman(amount) : ""}
            </p>
          </div>

          <div className={FIELD_CLASS}>
            <label htmlFor="expense-quantity" className={LABEL_CLASS}>
              تعداد
            </label>
            <div className="flex items-center gap-2.5">
              <input
                id="expense-quantity"
                type="text"
                inputMode="decimal"
                value={quantityRaw}
                onChange={(event) => setQuantityRaw(event.target.value)}
                placeholder="۱"
                className={INPUT_CLASS}
              />
              <div
                role="group"
                aria-label="واحد تعداد"
                className="flex shrink-0 overflow-hidden rounded-full border border-rule"
              >
                {(
                  [
                    { value: "piece", label: "عدد" },
                    { value: "kg", label: "کیلو" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={unit === option.value}
                    onClick={() => setUnit(option.value)}
                    className={`px-4 py-2 text-[13px] font-semibold ${
                      unit === option.value
                        ? "bg-accent text-white"
                        : "bg-panel text-ink-muted"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <p aria-live="polite" className="mt-1.5 text-[12px] text-ink-muted">
              {amount !== null && quantity !== 1 && unitPrice !== null
                ? unit === "kg"
                  ? `هر کیلو ${formatToman(unitPrice)}`
                  : `هر عدد ${formatToman(unitPrice)}`
                : ""}
            </p>
          </div>

          <div className={FIELD_CLASS}>
            <span id="expense-date-label" className={LABEL_CLASS}>
              تاریخ
            </span>
            <DatePicker
              value={date ? fromISODate(date) : null}
              calendar={persian}
              locale={persian_fa}
              editable={false}
              placeholder="بدون تاریخ"
              calendarPosition="top-start"
              // Portal out of the sheet: SheetPanel's overflow-auto would
              // otherwise clip the calendar (zIndex already tops the
              // sheet's own layers).
              portal
              zIndex={60}
              inputClass={PICKER_INPUT_CLASS}
              onChange={(value) => {
                if (value) setDate(toISODate(value.toDate()));
              }}
            />
            {date !== null && (
              <button
                type="button"
                onClick={() => setDate(null)}
                className="mt-2 text-[12.5px] text-accent hover:underline"
              >
                حذف تاریخ
              </button>
            )}
          </div>

          <div className={FIELD_CLASS}>
            <span className={LABEL_CLASS}>دسته</span>
            {lockedCategory ? (
              <div className="flex items-center gap-2.5">
                <span className={`${CHIP_CLASS} border-rule bg-paper`}>
                  <CategoryDot color={lockedCategory.color} />
                  <span>{lockedCategory.name}</span>
                </span>
                <span className="text-[12px] text-ink-muted">
                  دستهٔ این صفحه
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <span className={`${CHIP_CLASS} border-rule bg-paper`}>
                    {activeCategory && (
                      <CategoryDot color={activeCategory.color} />
                    )}
                    <span>{activeCategory?.name ?? "—"}</span>
                    {!manual && <Tag>پیشنهاد</Tag>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOptsOpen((wasOpen) => !wasOpen)}
                    className="text-[12.5px] text-accent hover:underline"
                  >
                    تغییر
                  </button>
                </div>
                {optsOpen && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        aria-pressed={category.id === activeCategoryId}
                        onClick={() => {
                          setPickedId(category.id);
                          setManual(true);
                        }}
                        className={`${OPTION_CLASS} ${
                          category.id === activeCategoryId
                            ? "border-accent bg-accent-soft"
                            : "border-rule bg-panel"
                        }`}
                      >
                        <CategoryDot color={category.color} />
                        {category.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {expense?.sourceRecurringId && (
            <p className="mt-3 rounded-[10px] bg-accent-soft px-3 py-2 text-[12px] leading-7 text-ink-muted">
              این خرج از الگو تولید شده؛ ویرایشش الگو را عوض نمی‌کند.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[13px] text-danger">
              {error}
            </p>
          )}

          {isEdit && confirmingDelete ? (
            <div className="mt-5 flex items-center gap-2.5">
              <p className="me-auto text-[13.5px] text-ink-muted">
                این خرج حذف شود؟
              </p>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className={BTN_GHOST}
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={pending}
                className="rounded-full bg-danger px-6 py-2.5 text-[14px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                حذف
              </button>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-2.5">
              {isEdit && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="me-auto rounded-full border border-danger px-5 py-2.5 text-[14px] font-semibold text-danger hover:bg-danger/5"
                >
                  حذف
                </button>
              )}
              <button type="button" onClick={onClose} className={BTN_GHOST}>
                انصراف
              </button>
              <button
                type="submit"
                disabled={!canSave}
                aria-busy={pending || undefined}
                className="rounded-full bg-accent px-6 py-2.5 text-[14px] font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {isEdit ? "ذخیره" : "ثبت"}
              </button>
            </div>
          )}
        </form>
    </SheetPanel>
  );
}
