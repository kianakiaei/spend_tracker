import { parseISO } from "date-fns-jalali";
import { dateOnlySchema } from "@/lib/schemas";

// The one module in the app that knows about calendars (ticket 12). Dates
// are stored as Gregorian date-only strings 'YYYY-MM-DD'; Jalali exists only
// in display and grouping. Pure — no `next/*` imports — so route handlers,
// RSC and the browser all share it (ticket 20).

/** Gregorian date-only string of a Date, from its local calendar parts. */
export function toISODate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local-midnight Date of a Gregorian date-only string — parseISO, never
 * new Date('YYYY-MM-DD') (that parses UTC and shifts a day off-zone). */
export function fromISODate(iso: string): Date {
  if (!dateOnlySchema.safeParse(iso).success) {
    throw new RangeError(
      `expected a Gregorian date-only string 'YYYY-MM-DD', got ${JSON.stringify(iso)}`,
    );
  }
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`not a real calendar date: ${JSON.stringify(iso)}`);
  }
  return d;
}
