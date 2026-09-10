// The app's one little accent tag (ticket 26's «از الگو»/«پیش‌بینی», ticket
// 27's «پیشنهاد») — same pill everywhere the ledger and the sheet mark a
// row or a chip.

export const TAG_CLASS =
  "shrink-0 rounded-full bg-accent-soft px-2 py-px text-[10px] font-medium text-accent";

/** The event badge (رویداد): the same pill but rule-bordered so the event's
 * name reads differently from the recurring/accent tags. */
export const TAG_EVENT_CLASS =
  "shrink-0 rounded-full border border-rule bg-panel px-2 py-px text-[10px] font-medium text-ink-muted";

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className={TAG_CLASS}>{children}</span>;
}
