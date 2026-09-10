import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { EventsManager } from "@/components/events-manager";
import { createEventService } from "@/lib/services";

// The events page: the user's named buckets (travel, …) with their overlay
// totals. An RSC reading the services DIRECTLY (ticket 12), guarded like
// the dashboard.

const eventService = createEventService(db);

export default async function EventsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const userId = session.user.id;

  const events = await eventService.list(userId);
  const summaries: Record<string, { totalToman: number; count: number }> = {};
  await Promise.all(
    events.map(async (event) => {
      summaries[event.id] = await eventService.summary(userId, event.id);
    }),
  );

  return (
    <div className="mx-auto w-full max-w-[680px] px-6 pb-10 pt-4">
      <Link href="/" className="text-[13px] text-ink-muted hover:text-ink">
        ‹ بازگشت به دفتر
      </Link>
      <h1 className="mt-2 text-[20px] font-bold">رویدادها</h1>
      <p className="mt-1 text-[13px] leading-7 text-ink-muted">
        هر رویداد یک جمع اضافه است (مثلاً سفر)؛ خرج‌هایش در ماه خودشان هم
        حساب می‌شوند. حذف رویداد فقط پیوند را برمی‌دارد، نه خرج‌ها را.
      </p>
      <EventsManager initialEvents={events} summaries={summaries} />
    </div>
  );
}
