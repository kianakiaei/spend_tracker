import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";

type AppDb = LibSQLDatabase<typeof schema> & { $client: Client };

const globalForDb = globalThis as unknown as {
  __spendTrackerClient?: Client;
  __spendTrackerDb?: AppDb;
};

function getClient(): Client {
  const cached = globalForDb.__spendTrackerClient;
  if (cached) return cached;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set — copy .env.example to .env (dev uses file:./local.db, never Turso remote)",
    );
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  // Cache on globalThis so dev HMR re-evals reuse the same client (research 09 §3.4).
  globalForDb.__spendTrackerClient = client;
  return client;
}

function getDb(): AppDb {
  if (!globalForDb.__spendTrackerDb) {
    globalForDb.__spendTrackerDb = drizzle(getClient(), { schema }) as AppDb;
  }
  return globalForDb.__spendTrackerDb;
}

// Created lazily on the first query — importing this module (e.g. while
// `next build` collects page data) must never throw for a missing DB.
// A missing TURSO_DATABASE_URL still fails loudly at request time.
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
