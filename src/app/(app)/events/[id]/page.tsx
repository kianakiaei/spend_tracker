import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { EventDeleteButton, EventDetailPanel } from "@/components/event-detail";
import { ExpenseSheetProvider } from "@/components/expense-sheet/provider";
import { formatNumber } from "@/lib/format";
import { currentJalaliMonthKey, formatJalali, fromISODate } from "@/lib/jalali";
import {
  createCategoryService,
  createEventService,
  getFallbackCategory,
  listLearnedKeys,
} from "@/lib/services";

// The event detail: the overlay total (big, like the dashboard), the
// event's expense rows (newest first), and «افزودن به این رویداد».

const categoryService = createCategoryService(db);
const eventService = createEventService(db);

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[id]">) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const userId = session.user.id;

  const event = await eventService.get(userId, id).catch(() => notFound());

  const [summary, expenses, categories, learnedKeys, fallback, allEvents] =
    await Promise.all([
      eventService.summary(userId, event.id),
      eventService.listExpenses(userId, event.id),
      categoryService.list(userId),
      listLearnedKeys(db, userId),
      getFallbackCategory(db, userId),
      eventService.list(userId),
    ]);

  return (
    <ExpenseSheetProvider
      monthKey={currentJalaliMonthKey()}
      categories={categories}
      events={allEvents}
      learnedKeys={learnedKeys}
      fallbackCategoryId={fallback.id}
    >
      <div className="mx-auto w-full max-w-[680px] px-6 pb-10 pt-4">
        <Link href="/events" className="text-[13px] text-ink-muted hover:text-ink">
          ‹ بازگشت به رویدادها
        </Link>

        <header className="mt-3 rounded-2xl border border-rule bg-panel px-5 pb-5 pt-4">
          <h1 className="text-[18px] font-bold">{event.title}</h1>
          {event.note && (
            <p className="mt-1 text-[13px] leading-7 text-ink-muted">
              {event.note}
            </p>
          )}
          {(event.startDate || event.endDate) && (
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {event.startDate && formatJalali(fromISODate(event.startDate), "d MMMM yyyy")}
              {event.startDate && event.endDate && " تا "}
              {event.endDate && formatJalali(fromISODate(event.endDate), "d MMMM yyyy")}
            </p>
          )}
          <p className="mt-2">
            <span className="text-[34px] font-extrabold leading-[1.35] tabular-nums">
              {formatNumber(summary.totalToman)}
            </span>
            <small className="ms-2 text-[13.5px] font-medium text-ink-muted">
              تومان
            </small>
          </p>
        </header>

        <EventDetailPanel
          event={event}
          expenses={expenses}
          categories={categories}
          monthKey={currentJalaliMonthKey()}
        />

        <div className="mt-8 border-t border-rule pt-4">
          <EventDeleteButton eventId={event.id} />
        </div>
      </div>
    </ExpenseSheetProvider>
  );
}

