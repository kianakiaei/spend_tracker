import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

// The db client reads TURSO_DATABASE_URL at module init, so the env must be
// set before the first dynamic import below. Vitest forks + isolation keep
// this file's env/module registry separate from other test files.
const dbUrl = `file:${join(tmpdir(), `domain-schema-${randomUUID()}.db`)}`;
process.env.TURSO_DATABASE_URL = dbUrl;

const { createClient } = await import("@libsql/client");
const { drizzle } = await import("drizzle-orm/libsql");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { auth } = await import("@/lib/auth");
const { categories, expenses } = await import("@/db/schema");
const { newId } = await import("@/lib/id");
const { SYSTEM_CATEGORIES } = await import(
  "@/lib/categorization/seed-lexicon"
);

const ORIGIN = "http://localhost:3000";

let userCounter = 0;

async function signUp(): Promise<string> {
  const res = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "کاربر آزمون",
        email: `domain-${++userCounter}-${randomUUID()}@example.com`,
        password: "test-password-123",
      }),
    }),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { user?: { id?: string } };
  expect(body.user?.id, "sign-up must return the user").toBeTruthy();
  return body.user!.id!;
}

describe("domain schema on local libSQL (ticket 19)", () => {
  const client = createClient({ url: dbUrl });
  const db = drizzle(client);

  beforeAll(async () => {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  });

  afterAll(async () => {
    await client.close();
  });

  it("seeds exactly the six system categories on sign-up", async () => {
    const userId = await signUp();

    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId));

    expect(rows).toHaveLength(SYSTEM_CATEGORIES.length);
    const byOrder = [...rows].sort((a, b) => a.order - b.order);
    expect(byOrder.map((c) => c.slug)).toEqual(
      SYSTEM_CATEGORIES.map((c) => c.slug),
    );
    expect(byOrder.map((c) => c.name)).toEqual(
      SYSTEM_CATEGORIES.map((c) => c.name),
    );
    for (const [index, row] of byOrder.entries()) {
      expect(row.kind).toBe("system");
      expect(row.slug).toBeTruthy();
      expect(row.order).toBe(index);
      expect(row.color, "initial color set").toBeTruthy();
      expect(row.icon).toBeNull();
      expect(uuidv7Shape(row.id)).toBe(true);
    }
  });

  it("makes the recurring idempotency index a real no-op with ON CONFLICT DO NOTHING", async () => {
    const userId = await signUp();
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .limit(1);

    const sourceRecurringId = newId();
    const now = new Date();
    const base = {
      amountToman: 1_500_000,
      title: "قسط وام",
      categoryId: category.id,
      monthKey: "1405-06",
      sourceRecurringId,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    const conflictTarget = [
      expenses.userId,
      expenses.sourceRecurringId,
      expenses.monthKey,
    ] as const;
    await db
      .insert(expenses)
      .values({ ...base, id: newId() })
      .onConflictDoNothing({ target: [...conflictTarget] });
    await db
      .insert(expenses)
      .values({ ...base, id: newId() })
      .onConflictDoNothing({ target: [...conflictTarget] });

    const stored = await db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId));
    expect(stored).toHaveLength(1);
  });

  it("rejects a duplicate category name for the same user", async () => {
    const userId = await signUp();
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .limit(1);

    const now = new Date();
    await expect(
      db.insert(categories).values({
        id: newId(),
        name: existing.name,
        kind: "custom",
        order: 100,
        userId,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });
});

function uuidv7Shape(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    id,
  );
}
