"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DatePicker from "react-multi-date-picker";
// The OFFICIAL persian calendar + locale (research 04 — never `jalali`).
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { CategoryDot, categoryColorMap } from "./category-color";
import { LedgerRowBody } from "./expense-rows";
import { parseAmountInput } from "./expense-sheet/sheet-helpers";
import { SheetPanel } from "./ui/sheet-panel";
import { useRun } from "./ui/use-run";
import { toTemplateRow } from "./ui/client-row";
import {
  BTN_GHOST,
  BTN_PRIMARY,
  CHIP_CLASS,
  CHIP_PRESSED,
  CHIP_QUIET,
  FIELD_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PICKER_INPUT_CLASS,
} from "./ui/style";
import { api } from "@/lib/api/client";
import {
  currentTehranISODate,
  formatJalali,
  formatToman,
  fromISODate,
  fromJalaliMonthKey,
  jalaliDayOfMonth,
  jalaliMonthLabel,
  toISODate,
  toPersianDigits,
} from "@/lib/jalali";
import type { Category, RecurringTemplate } from "@/lib/services";
import type { RecurringForecastRow } from "@/lib/recurring";

// The templates page's island (ticket 28): the list of templates with
// pause/resume (the service's `active`), the «خرج این ماه تولید شد» link
// deep into the generated expense (the dashboard opens its edit sheet),
// the future-months preview with clamped days (decision 15), and the
// create/edit sheet — same anatomy as the expense sheet, one day-of-month
// field instead of a free date. A ?edit= deep-link (a ledger forecast row
// lands here, decision 15) opens that template's sheet once and strips
// itself from the URL. Creating or editing a template TEACHES the engine
// (decision 06) — that is the server's business on save.

const PAGE_PARAM = "edit";

/** 1..31 as the sheet understands it — null while the field is not a
 * legal Jalali day. */
function parseDayInput(raw: string): number | null {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= 31 ? value : null;
}

export function TemplatesManager({
  initialTemplates,
  categories,
  currentMonthKey,
  generatedThisMonth,
  previewMonths,
  initialEditId,
}: {
  initialTemplates: RecurringTemplate[];
  categories: Category[];
  currentMonthKey: string;
  /** templateId → expenseId for templates that generated THIS month's
   * expense (decision 14's lazy generation). */
  generatedThisMonth: Record<string, string>;
  previewMonths: { monthKey: string; rows: RecurringForecastRow[] }[];
  /** The ?edit= deep-link's template — a ledger forecast row's
   * «کلیک = ویرایش الگو» (decision 15). */
  initialEditId?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialTemplates);
  const [sheet, setSheet] = useState<
    { mode: "create" } | { mode: "edit"; template: RecurringTemplate } | null
  >(() => {
    const template = initialTemplates.find((t) => t.id === initialEditId);
    return template ? { mode: "edit", template } : null;
  });
  const { run, pending, error } = useRun();

  // The deep-link is one-shot: strip it from the address so a later manual
  // refresh doesn't resurrect the sheet.
  useEffect(() => {
    if (initialEditId === undefined) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(PAGE_PARAM);
    window.history.replaceState(null, "", url.toString());
    // Once on mount — the sheet state owns it from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colorOf = categoryColorMap(categories);

  const toggle = (template: RecurringTemplate) =>
    run(async () => {
      const updated = await api.recurringTemplates.update(template.id, {
        active: !template.active,
      });
      setRows((prev) =>
        prev.map((row) => (row.id === updated.id ? toTemplateRow(updated) : row)),
      );
      router.refresh();
    }, "انجام نشد؛ دوباره تلاش کنید.");

  return (
    <>
      {rows.length === 0 ? (
        <p className="mt-6 border-t-2 border-ink pt-6 text-center text-[14.5px] leading-8 text-ink-muted">
          الگویی برای تولید خودکار خرج ماهانه نساخته‌ای.
        </p>
      ) : (
        <ul className="mt-4 border-t-2 border-ink" aria-label="الگوهای تکرار">
          {rows.map((template) => {
            const generatedId = generatedThisMonth[template.id];
            return (
              <li key={template.id} className="border-b border-rule">
                <div className="flex items-center gap-2.5 py-3">
                  <CategoryDot color={colorOf.get(template.categoryId) ?? null} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[14px] font-semibold">
                      <span className="truncate">{template.title}</span>
                      {!template.active && (
                        <span className="shrink-0 rounded-full border border-rule bg-panel px-2 py-px text-[10px] font-medium text-ink-muted">
                          متوقف
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {formatToman(template.amountToman)} · هر ماه، روز{" "}
                      {toPersianDigits(template.dayOfMonth)}
                      {template.endDate !== null &&
                        ` · تا ${formatJalali(fromISODate(template.endDate), "MMMM yyyy")}`}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-3 text-[12.5px]">
                    {generatedId !== undefined && (
                      <Link
                        href={`/?month=${currentMonthKey}&expense=${generatedId}`}
                        className="text-accent hover:underline"
                      >
                        خرج این ماه تولید شد
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => void toggle(template)}
                      disabled={pending}
                      className="text-accent hover:underline disabled:opacity-60"
                    >
                      {template.active ? "توقف" : "ازسرگیری"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSheet({ mode: "edit", template })}
                      className="text-accent hover:underline"
                    >
                      ویرایش
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        aria-label="افزودن الگو"
        onClick={() => setSheet({ mode: "create" })}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-rule-strong bg-panel px-4 py-3 text-[14px] font-semibold text-accent hover:border-accent"
      >
        + افزودن الگو
      </button>

      {previewMonths.length > 0 && (
        <section className="mt-8" aria-label="پیش‌بینی ماه‌های آینده">
          <h2 className="text-[14px] font-bold">پیش‌بینی ماه‌های آینده</h2>
          {previewMonths.map(({ monthKey, rows: forecastRows }) => {
            const monthName = formatJalali(fromJalaliMonthKey(monthKey), "MMMM");
            return (
              <div key={monthKey} className="mt-3">
                <h3 className="text-[12.5px] font-semibold text-ink-muted">
                  {jalaliMonthLabel(fromJalaliMonthKey(monthKey))}
                </h3>
                <ul className="mt-1 border-t border-rule">
                  {forecastRows.map((row) => (
                    <li key={row.templateId} className="border-b border-rule">
                      <div className="flex items-center gap-2.5 py-2.5">
                        <LedgerRowBody
                          day={`${toPersianDigits(row.day)} ${monthName}`}
                          title={row.title}
                          color={colorOf.get(row.categoryId) ?? null}
                          tag="پیش‌بینی"
                          amountToman={row.amountToman}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {sheet !== null && (
        <TemplateSheet
          key={sheet.mode === "edit" ? sheet.template.id : "create"}
          sheet={sheet}
          categories={categories}
          onClose={() => setSheet(null)}
          onSaved={(template) => {
            setRows((prev) =>
              prev.some((row) => row.id === template.id)
                ? prev.map((row) => (row.id === template.id ? template : row))
                : [...prev, template],
            );
            setSheet(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function TemplateSheet({
  sheet,
  categories,
  onClose,
  onSaved,
}: {
  sheet: { mode: "create" } | { mode: "edit"; template: RecurringTemplate };
  categories: Category[];
  onClose: () => void;
  onSaved: (template: RecurringTemplate) => void;
}) {
  const isEdit = sheet.mode === "edit";
  const template = isEdit ? sheet.template : null;

  const [title, setTitle] = useState(template?.title ?? "");
  const [amountRaw, setAmountRaw] = useState(
    template ? String(template.amountToman) : "",
  );
  const [dayRaw, setDayRaw] = useState(
    template
      ? String(template.dayOfMonth)
      : String(jalaliDayOfMonth(fromISODate(currentTehranISODate()))),
  );
  const [categoryId, setCategoryId] = useState(
    template?.categoryId ?? categories[0]?.id ?? "",
  );
  const [startDate, setStartDate] = useState(
    template?.startDate ?? currentTehranISODate(),
  );
  const [endDate, setEndDate] = useState<string | null>(template?.endDate ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = parseAmountInput(amountRaw);
  const day = parseDayInput(dayRaw);
  const canSave =
    title.trim() !== "" && amount !== null && day !== null && !pending;

  async function save() {
    if (pending || amount === null || day === null || title.trim() === "") return;
    setPending(true);
    setError(null);
    try {
      const payload = {
        amountToman: amount,
        title: title.trim(),
        categoryId,
        dayOfMonth: day,
        startDate,
        endDate,
      };
      const dto =
        isEdit && template !== null
          ? await api.recurringTemplates.update(template.id, payload)
          : await api.recurringTemplates.create(payload);
      onSaved(toTemplateRow(dto));
    } catch {
      // One generic voice; every field keeps what the user typed.
      setError("ذخیره نشد؛ دوباره تلاش کنید.");
      setPending(false);
    }
  }

  return (
    <SheetPanel onClose={onClose} labelledBy="template-sheet-title">
      <h2 id="template-sheet-title" className="text-[17px] font-bold">
        {isEdit ? "ویرایش الگو" : "الگوی تکرار"}
      </h2>
      <p className="mt-0.5 text-[13px] text-ink-muted">
        هر ماه، یک بار خرج می‌سازد — ماه‌های گذشته از تاریخ شروع هم با ذخیره
        ساخته می‌شوند؛ روزهای بلندِ ماه‌های کوتاه به آخر ماه می‌چسبند.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className={FIELD_CLASS}>
          <label htmlFor="template-title" className={LABEL_CLASS}>
            عنوان
          </label>
          <input
            id="template-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثلاً قسط وام"
            autoFocus
            className={INPUT_CLASS}
          />
        </div>

        <div className={FIELD_CLASS}>
          <label htmlFor="template-amount" className={LABEL_CLASS}>
            مبلغ
          </label>
          <input
            id="template-amount"
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
          <label htmlFor="template-day" className={LABEL_CLASS}>
            روز ماه
          </label>
          <input
            id="template-day"
            type="number"
            min={1}
            max={31}
            value={dayRaw}
            onChange={(event) => setDayRaw(event.target.value)}
            className={`${INPUT_CLASS} max-w-24`}
          />
          <span className="ms-2 text-[12px] text-ink-muted">۱ تا ۳۱</span>
        </div>

        <div className={FIELD_CLASS}>
          <span className={LABEL_CLASS}>دسته</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={category.id === categoryId}
                onClick={() => setCategoryId(category.id)}
                className={`${CHIP_CLASS} ${category.id === categoryId
                    ? "border-accent bg-accent-soft"
                    : "border-rule bg-panel"
                  }`}
              >
                <CategoryDot color={category.color} />
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className={FIELD_CLASS}>
          <span id="template-start-label" className={LABEL_CLASS}>
            تاریخ شروع
          </span>
          <div className="flex items-center gap-2.5">
            <DatePicker
              value={fromISODate(startDate)}
              calendar={persian}
              locale={persian_fa}
              editable={false}
              placeholder="انتخاب تاریخ"
              calendarPosition="top-start"
              // Portal out of the sheet: SheetPanel's overflow-auto would
              // otherwise clip the calendar.
              portal
              zIndex={60}
              inputClass={PICKER_INPUT_CLASS}
              onChange={(value) => {
                if (value) setStartDate(toISODate(value.toDate()));
              }}
            />
          </div>
        </div>

        <div className={FIELD_CLASS}>
          <span id="template-end-label" className={LABEL_CLASS}>
            تاریخ پایان (اختیاری)
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-pressed={endDate === null}
              onClick={() => setEndDate(null)}
              className={`${CHIP_CLASS} ${endDate === null ? CHIP_PRESSED : CHIP_QUIET}`}
            >
              بدون پایان
            </button>
            <DatePicker
              value={endDate ? fromISODate(endDate) : null}
              calendar={persian}
              locale={persian_fa}
              editable={false}
              placeholder="انتخاب تاریخ"
              calendarPosition="top-start"
              // Portal out of the sheet: SheetPanel's overflow-auto would
              // otherwise clip the calendar.
              portal
              zIndex={60}
              inputClass={PICKER_INPUT_CLASS}
              onChange={(value) => {
                setEndDate(value ? toISODate(value.toDate()) : null);
              }}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center gap-2.5">
          <button type="button" onClick={onClose} className={`${BTN_GHOST} me-auto`}>
            انصراف
          </button>
          <button
            type="submit"
            disabled={!canSave}
            aria-busy={pending || undefined}
            className={BTN_PRIMARY}
          >
            {isEdit ? "ذخیره" : "ثبت"}
          </button>
        </div>
      </form>
    </SheetPanel>
  );
}
