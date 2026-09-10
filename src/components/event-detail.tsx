"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useExpenseSheet } from "./expense-sheet/provider";
import { ExpenseRows } from "./expense-rows";
import { useRun } from "./ui/use-run";
import { api } from "@/lib/api/client";
import type { Category, EventRow, ExpenseWithCategory } from "@/lib/services";
import { BTN_DANGER, BTN_GHOST } from "./ui/style";


export function EventDetailPanel({
  event,
  expenses,
  categories,
  monthKey,
}: {
  event: EventRow;
  expenses: ExpenseWithCategory[];
  categories: Category[];
  monthKey: string;
}) {
  const { openCreate } = useExpenseSheet();

  return (
    <>
      <button
        type="button"
        onClick={() => openCreate({ eventId: event.id })}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-rule-strong bg-panel px-4 py-3 text-[14px] font-semibold text-accent hover:border-accent"
      >
        + افزودن به این رویداد
      </button>

      {expenses.length === 0 ? (
        <p className="mt-10 text-center text-[14.5px] leading-8 text-ink-muted">
          {event.title} هنوز خرجی ندارد.
        </p>
      ) : (
        <section
          className="mt-6 border-t-2 border-ink"
          aria-label={`خرج‌های ${event.title}`}
        >
          <ExpenseRows
            monthKey={monthKey}
            expenses={expenses}
            forecast={[]}
            categories={categories}
          />
        </section>
      )}
    </>
  );
}

export function EventDeleteButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { run, pending, error } = useRun();
  const [confirming, setConfirming] = useState(false);

  const removeEvent = () =>
    run(async () => {
      await api.events.remove(eventId);
      router.push("/events");
      router.refresh();
    }, "حذف نشد؛ دوباره تلاش کنید.");

  if (!confirming) {
    return (
      <>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-full border border-danger px-5 py-2.5 text-[14px] font-semibold text-danger hover:bg-danger/5"
        >
          حذف رویداد
        </button>
        {error && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2.5">
        <p className="me-auto text-[13.5px] text-ink-muted">
          رویداد حذف شود؟ خرج‌ها می‌مانند.
        </p>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={BTN_GHOST}
        >
          انصراف
        </button>
        <button
          type="button"
          onClick={() => void removeEvent()}
          disabled={pending}
          className={BTN_DANGER}
        >
          حذف
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}
    </>
  );
}

// The event detail's interactive half: «افزودن به این رویداد» opens the
// sheet with the event pre-selected; rows open the edit sheet.
