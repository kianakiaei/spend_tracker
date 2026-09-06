import { z } from "zod";

// Domain constraint primitives (ticket 19). Request/response DTOs compose
// these from ticket 25; service writes compose them from tickets 22-24.

/** Integer toman amounts — tomans are the smallest unit, always positive. */
export const amountTomanSchema = z.number().int().positive();

/** Gregorian date-only string stored as-is ('2026-09-06'). Format-level only
 * (month 01-12, day 01-31): real-calendar validity is the date picker's job. */
export const dateOnlySchema = z.string().regex(
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  "expected a Gregorian date-only string 'YYYY-MM-DD'",
);

/** Jalali calendar month key ('1405-06') — the grouping unit for all monthly
 * sums. */
export const jalaliMonthKeySchema = z.string().regex(
  /^\d{4}-(0[1-9]|1[0-2])$/,
  "expected a Jalali month key 'YYYY-MM'",
);

/** Jalali day-of-month of a recurring template; months without the day clamp
 * to their last day at generation time (ticket 05). */
export const dayOfMonthSchema = z.number().int().min(1).max(31);

/** The six seeded categories are 'system'; anything the user makes is
 * 'custom'. */
export const categoryKindSchema = z.enum(["system", "custom"]);

/** Only learned keys are stored — system lexicon keys never enter the DB
 * (ticket 13). */
export const learnedKeySourceSchema = z.literal("learned");

/** Every domain id is a UUIDv7 generated in the app (ticket 05). */
export const uuidv7Schema = z.uuid({ version: "v7" });

/** Expense/template titles: trimmed, never empty — normalization (canonical)
 * happens separately in the categorization engine. */
export const titleSchema = z.string().trim().min(1, "title is required");

/** Category names: trimmed, never empty, unique per user. */
export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "category name is required");
