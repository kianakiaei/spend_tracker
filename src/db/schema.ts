import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// better-auth tables (ticket 18) + domain tables (ticket 19).
// Field names follow the better-auth drizzle-adapter schema for sqlite.

// --- Domain tables (ticket 19) ---
// libSQL ships with FK enforcement off (research 09): the domain rules
// ("no deleting a category that has expenses", "system categories are
// undeletable") are enforced in the service layer (ticket 22) — plain
// columns here. Domain ids are app-generated UUIDv7 (src/lib/id.ts).

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" }),
});

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    icon: text("icon"),
    color: text("color"),
    // 'system' | 'custom' — categoryKindSchema (src/lib/schemas)
    kind: text("kind").notNull(),
    // Dashboard/list order, ascending.
    order: integer("order").notNull(),
    // Set only on the six system rows — the code↔category bridge (ticket 13).
    slug: text("slug"),
    userId: text("userId").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [uniqueIndex("categories_user_name_unique").on(t.userId, t.name)],
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    // Integer tomans, always > 0 — amountTomanSchema (src/lib/schemas).
    amountToman: integer("amountToman").notNull(),
    title: text("title").notNull(),
    note: text("note"),
    // NOT NULL: there is no "uncategorized" group (ticket 05).
    categoryId: text("categoryId").notNull(),
    // Gregorian date-only 'YYYY-MM-DD'; null = undated expense, a member of
    // the month it was entered in (ticket 15).
    occurredAt: text("occurredAt"),
    // Jalali month key '1405-06', always set — derived on write from
    // occurredAt when dated, otherwise the entry month.
    monthKey: text("monthKey").notNull(),
    // Set only on expenses generated from a recurring template.
    sourceRecurringId: text("sourceRecurringId"),
    userId: text("userId").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    // Idempotency of recurring generation (ticket 14): the same template in
    // the same month inserts once; NULL sourceRecurringId stays distinct.
    uniqueIndex("expenses_user_source_recurring_month_unique").on(
      t.userId,
      t.sourceRecurringId,
      t.monthKey,
    ),
    // Month reads: dashboard sum, category breakdown, expense list.
    index("expenses_user_month_idx").on(t.userId, t.monthKey),
  ],
);

export const recurringTemplates = sqliteTable("recurringTemplates", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  amountToman: integer("amountToman").notNull(),
  categoryId: text("categoryId").notNull(),
  // Jalali day 1..31; months without the day clamp to their last day.
  dayOfMonth: integer("dayOfMonth").notNull(),
  // Gregorian date-only 'YYYY-MM-DD'.
  startDate: text("startDate").notNull(),
  endDate: text("endDate"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  userId: text("userId").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

export const learnedKeys = sqliteTable(
  "learnedKeys",
  {
    // Normalized key form — canonical output of the normalizer (ticket 21).
    key: text("key").notNull(),
    categoryId: text("categoryId").notNull(),
    count: integer("count").notNull(),
    // Always 'learned' — system lexicon keys never enter this table
    // (ticket 13).
    source: text("source").notNull().default("learned"),
    userId: text("userId").notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  // (userId, key) is the row's identity — one counter per user and key — so
  // the ticket-19 index requirement is carried by the composite PK itself.
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);
