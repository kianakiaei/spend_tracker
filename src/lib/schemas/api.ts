import { z } from "zod";
import {
  amountTomanSchema,
  categoryKindSchema,
  categoryNameSchema,
  categoryOrderSchema,
  dateOnlySchema,
  dayOfMonthSchema,
  eventTitleSchema,
  jalaliMonthKeySchema,
  quantitySchema,
  refineUnitQuantity,
  titleSchema,
  unitSchema,
  uuidv7Schema,
} from "./domain";

// Request/response DTOs of the v1 API (ticket 25), composed from the domain
// primitives above. Handlers parse incoming bodies/queries with the request
// schemas (thin parseJson/parseQuery helpers); the typed fetch client parses
// outgoing rows with the response schemas — one shape for web and mobile
// (ticket 12). RSC never goes through these; it calls the services directly.

// --- Requests ---

/** POST /api/v1/expenses — `entryMonthKey` is the month the form was opened
 * in, used only when the expense is undated (ticket 15). */
export const createExpenseRequestSchema = z
  .object({
    amountToman: amountTomanSchema,
    quantity: quantitySchema.optional(),
    unit: unitSchema.optional(),
    title: titleSchema,
    note: z.string().nullish(),
    categoryId: uuidv7Schema,
    occurredAt: dateOnlySchema.nullish(),
    eventId: uuidv7Schema.nullish(),
    entryMonthKey: jalaliMonthKeySchema,
  })
  .superRefine(refineUnitQuantity);

export const updateExpenseRequestSchema = z
  .object({
    amountToman: amountTomanSchema.optional(),
    quantity: quantitySchema.optional(),
    unit: unitSchema.optional(),
    title: titleSchema.optional(),
    note: z.string().nullish(),
    categoryId: uuidv7Schema.optional(),
    occurredAt: dateOnlySchema.nullish(),
    eventId: uuidv7Schema.nullish(),
  })
  .superRefine(refineUnitQuantity);

export const createCategoryRequestSchema = z.object({
  name: categoryNameSchema,
  color: z.string().nullish(),
  icon: z.string().nullish(),
});

/** PATCH /api/v1/categories/[id] — rename/restyle freely; `order` is the
 * ticket-28 reorder (the manager swaps two PATCHes). */
export const updateCategoryRequestSchema = z.object({
  name: categoryNameSchema.optional(),
  color: z.string().nullish(),
  icon: z.string().nullish(),
  order: categoryOrderSchema.optional(),
});

/** POST /api/v1/categories/[id]/move-expenses — bulk move for the
 * delete-category flow (ticket 05). */
export const moveExpensesRequestSchema = z.object({
  targetCategoryId: uuidv7Schema,
});

export const createTemplateRequestSchema = z.object({
  amountToman: amountTomanSchema,
  title: titleSchema,
  categoryId: uuidv7Schema,
  dayOfMonth: dayOfMonthSchema,
  startDate: dateOnlySchema,
  endDate: dateOnlySchema.nullish(),
});

export const updateTemplateRequestSchema = z.object({
  amountToman: amountTomanSchema.optional(),
  title: titleSchema.optional(),
  categoryId: uuidv7Schema.optional(),
  dayOfMonth: dayOfMonthSchema.optional(),
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.nullish(),
  active: z.boolean().optional(),
});

/** POST /api/v1/classify — side-effect-free suggestion (ticket 06). */
export const classifyRequestSchema = z.object({
  title: titleSchema,
});

/** The `?month=` of the monthly reads: expenses, summaries, recurring
 * preview — the app's one consumption unit (ticket 12). */
export const monthQuerySchema = z.object({
  month: jalaliMonthKeySchema,
});

/** GET /api/v1/search?q= — the whole-ledger title search. Blank is legal and
 * means «nothing typed yet»: the handler answers an empty list. */
export const searchQuerySchema = z.object({
  q: z.string().max(200),
});

// --- Responses (the JSON serialization of the service rows) ---

/** An ISO timestamp as JSON.stringify writes a Date. */
const isoTimestampSchema = z.iso.datetime();

/** better-auth mints opaque string ids (never UUIDs) — response `userId`s
 * are strings; only domain ids (id/categoryId/templateId/…) are UUIDv7. */
const authUserIdSchema = z.string();

export const categoryResponseSchema = z.object({
  id: uuidv7Schema,
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  kind: categoryKindSchema,
  order: z.number().int(),
  slug: z.string().nullable(),
  userId: authUserIdSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

export const expenseResponseSchema = z.object({
  id: uuidv7Schema,
  amountToman: z.number().int().positive(),
  quantity: z.number().positive(),
  unit: unitSchema,
  title: z.string(),
  note: z.string().nullable(),
  categoryId: uuidv7Schema,
  occurredAt: dateOnlySchema.nullable(),
  monthKey: jalaliMonthKeySchema,
  sourceRecurringId: uuidv7Schema.nullable(),
  eventId: uuidv7Schema.nullable(),
  userId: authUserIdSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  category: categoryResponseSchema,
});

export const recurringTemplateResponseSchema = z.object({
  id: uuidv7Schema,
  title: z.string(),
  amountToman: z.number().int().positive(),
  categoryId: uuidv7Schema,
  dayOfMonth: z.number().int().min(1).max(31),
  startDate: dateOnlySchema,
  endDate: dateOnlySchema.nullable(),
  active: z.boolean(),
  userId: authUserIdSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

/** GET /api/v1/recurring-templates/preview?month= — the ticket-15 forecast
 * row; `day` is the clamped Jalali day-of-month. */
export const forecastRowResponseSchema = z.object({
  templateId: uuidv7Schema,
  title: z.string(),
  amountToman: z.number().int().positive(),
  categoryId: uuidv7Schema,
  day: z.number().int().min(1).max(31),
});

export const monthSummaryResponseSchema = z.object({
  monthKey: jalaliMonthKeySchema,
  totalToman: z.number().int(),
  byCategory: z.array(
    z.object({
      categoryId: uuidv7Schema,
      name: z.string(),
      totalToman: z.number().int(),
      count: z.number().int(),
    }),
  ),
  forecastToman: z.number().int().optional(),
});

/** GET /api/v1/search?q= — one hit: the fields the search page renders
 * (item title, price, Jalali month of the purchase, category chip). */
export const searchResultResponseSchema = z.object({
  expenseId: uuidv7Schema,
  title: z.string(),
  amountToman: z.number().int().positive(),
  quantity: z.number().positive(),
  monthKey: jalaliMonthKeySchema,
  occurredAt: dateOnlySchema.nullable(),
  categoryName: z.string(),
  categoryId: uuidv7Schema,
});

/** POST /api/v1/classify — always 200 on a valid title; the fallback answer
 * carries matchedKey: null and confidence: null (ticket 12). */
export const classifyResponseSchema = z.object({
  categoryId: uuidv7Schema,
  source: z.enum(["learned", "system", "fallback"]),
  matchedKey: z.string().nullable(),
  confidence: z
    .object({ purity: z.number(), support: z.number() })
    .nullable(),
});

export const moveExpensesResponseSchema = z.object({
  moved: z.number().int().nonnegative(),
});

/** POST /api/v1/events — title unique per user; dates display-only. */
export const createEventRequestSchema = z
  .object({
    title: eventTitleSchema,
    note: z.string().nullish(),
    startDate: dateOnlySchema.nullish(),
    endDate: dateOnlySchema.nullish(),
  })
  .superRefine((data, ctx) => {
    if (
      data.startDate != null &&
      data.endDate != null &&
      data.endDate < data.startDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "end date must not be before start date",
      });
    }
  });

/** PATCH /api/v1/events/[id] — rename freely; dates display-only. */
export const updateEventRequestSchema = z
  .object({
    title: eventTitleSchema.optional(),
    note: z.string().nullish(),
    startDate: dateOnlySchema.nullish(),
    endDate: dateOnlySchema.nullish(),
  })
  .superRefine((data, ctx) => {
    if (
      data.startDate != null &&
      data.endDate != null &&
      data.endDate < data.startDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "end date must not be before start date",
      });
    }
  });

export const eventResponseSchema = z.object({
  id: uuidv7Schema,
  title: z.string(),
  note: z.string().nullable(),
  startDate: dateOnlySchema.nullable(),
  endDate: dateOnlySchema.nullable(),
  userId: authUserIdSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});

// --- z.infer types shared by handler and client ---

export type CreateExpenseRequest = z.infer<typeof createExpenseRequestSchema>;
export type UpdateExpenseRequest = z.infer<typeof updateExpenseRequestSchema>;
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;
export type MoveExpensesRequest = z.infer<typeof moveExpensesRequestSchema>;
export type CreateTemplateRequest = z.infer<typeof createTemplateRequestSchema>;
export type UpdateTemplateRequest = z.infer<typeof updateTemplateRequestSchema>;
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;
export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>;
export type ClassifyRequest = z.infer<typeof classifyRequestSchema>;
export type MonthQuery = z.infer<typeof monthQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export type CategoryDto = z.infer<typeof categoryResponseSchema>;
export type ExpenseDto = z.infer<typeof expenseResponseSchema>;
export type RecurringTemplateDto = z.infer<
  typeof recurringTemplateResponseSchema
>;
export type EventDto = z.infer<typeof eventResponseSchema>;
export type ForecastRowDto = z.infer<typeof forecastRowResponseSchema>;
export type MonthSummaryDto = z.infer<typeof monthSummaryResponseSchema>;
export type ClassifyDto = z.infer<typeof classifyResponseSchema>;
export type MoveExpensesDto = z.infer<typeof moveExpensesResponseSchema>;
export type SearchResultDto = z.infer<typeof searchResultResponseSchema>;
