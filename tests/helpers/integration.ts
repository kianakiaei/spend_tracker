import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DomainDb } from "@/lib/services/types";

// Shared fixture for service/DB integration tests (ticket 22 pattern, after
// tests/integration/domain-schema.test.ts): a fresh temp libSQL file per test
// FILE, migrated with the real drizzle migrations — never Turso, never
// :memory: across files. The db client reads TURSO_DATABASE_URL at module
// init, so the env must be set before the first dynamic import below; vitest
// runs each test file in its own process, which keeps these per-file envs
// and module registries apart.
//
// signUp() inserts the user directly and then runs the same seeding the
// better-auth registration hook runs (databaseHooks.user.create.after), so
// every test user starts with the six system categories.

export interface IntegrationFixture {
  db: DomainDb;
  /** New user id, with the six system categories seeded. */
  signUp(name?: string): Promise<string>;
  close(): Promise<void>;
}

export async function setupIntegrationDb(prefix: string): Promise<IntegrationFixture> {
  const dbUrl = `file:${join(tmpdir(), `${prefix}-${randomUUID()}.db`)}`;
  process.env.TURSO_DATABASE_URL = dbUrl;

  const { db } = await import("@/db");
  const { migrate } = await import("drizzle-orm/libsql/migrator");
  const { user } = await import("@/db/schema");
  const { newId } = await import("@/lib/id");
  const { seedSystemCategories } = await import(
    "@/lib/services/seed-system-categories"
  );

  await migrate(db, { migrationsFolder: "./drizzle" });

  let counter = 0;

  return {
    db,
    async signUp(name = "کاربر آزمون") {
      const userId = newId();
      const now = new Date();
      await db.insert(user).values({
        id: userId,
        name,
        email: `${prefix}-${++counter}-${randomUUID()}@example.com`,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      await seedSystemCategories(userId);
      return userId;
    },
    async close() {
      await db.$client.close();
    },
  };
}
