"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { canonical } from "@/lib/categorization/normalize";
import {
  formatJalali,
  formatToman,
  fromISODate,
  fromJalaliMonthKey,
  jalaliMonthLabel,
  toPersianDigits,
} from "@/lib/jalali";
import type { SearchResultDto } from "@/lib/schemas";
import type { SheetExpense } from "./expense-sheet/provider";
import { useExpenseSheet } from "./expense-sheet/provider";
import { TAG_EVENT_CLASS } from "./tag";

// The search results list (تیکت جست‌وجو): the user types an item and sees
// every purchase of it across ALL months — which Jalali month it landed in
// and for how much. The query filter runs client-side against the canonical
// form so «شير» still matches «شیر»; the server already applied the same
// rule to the fetched page. A click opens the same edit sheet as the home
// ledger.

function toSheetExpense(hit: SearchResultDto): SheetExpense {
  return {
    id: hit.expenseId,
    title: hit.title,
    amountToman: hit.amountToman,
    quantity: hit.quantity,
    unit: hit.unit,
    occurredAt: hit.occurredAt,
    monthKey: hit.monthKey,
    categoryId: hit.categoryId,
    eventId: hit.eventId,
    sourceRecurringId: hit.sourceRecurringId,
  };
}

export function SearchBoard({ results }: { results: SearchResultDto[] }) {
  const { openEdit } = useExpenseSheet();
  const [query, setQuery] = useState("");

  const hits = useMemo(() => {
    const q = canonical(query);
    if (q === "") return results;
    return results.filter((r) => canonical(r.title).includes(q));
  }, [results, query]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-[20px] font-extrabold">جست‌وجو در همه ماه‌ها</h1>
        <nav className="flex gap-4 text-[13px] text-ink-muted">
          <Link href="/" className="hover:text-accent">
            داشبورد
          </Link>
          <Link href="/insights" className="hover:text-accent">
            بینش‌ها
          </Link>
        </nav>
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        عنوانِ یک قلم را بنویس تا ببینی در کدام ماه و با چه قیمتی خریده شده
      </p>

      <div className="mt-4">
        <label htmlFor="ledger-search" className="sr-only">
          جست‌وجوی خرج
        </label>
        <input
          id="ledger-search"
          type="search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جست‌وجو… مثلاً نان"
          aria-label="جست‌وجوی خرج"
          className="w-full rounded-2xl border border-rule bg-panel px-4 py-2.5 text-[14px] outline-none placeholder:text-ink-muted focus:border-accent"
        />
      </div>

      {hits.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-ink-muted">
          {results.length === 0
            ? "برای جست‌وجو، بخشی از عنوان را بنویس."
            : "خرجی با این عنوان پیدا نشد."}
        </p>
      ) : (
        <ul aria-label="نتایج جست‌وجو" className="mt-4">
          {hits.map((hit) => {
            const label = jalaliMonthLabel(fromJalaliMonthKey(hit.monthKey));
            return (
              <li key={hit.expenseId} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => openEdit(toSheetExpense(hit))}
                  className="flex w-full items-center justify-between gap-3 rounded-lg py-2.5 text-start hover:bg-accent-soft"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-semibold">
                      {hit.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-muted">
                      <span className="inline-flex items-center rounded-full border border-rule bg-panel px-2 py-0.5 text-[11px]">
                        {hit.categoryName}
                      </span>
                      {hit.eventTitle !== null && (
                        <span className={TAG_EVENT_CLASS}>{hit.eventTitle}</span>
                      )}
                      {label}
                      {formatJalali(fromISODate(hit.occurredAt), "d MMMM")}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-[13.5px] font-bold">
                    {formatToman(hit.amountToman)}
                    <span className="ms-1 text-[11.5px] font-medium text-ink-muted">
                      · {toPersianDigits(hit.quantity)} عدد
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
