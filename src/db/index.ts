import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL;

const globalForDb = globalThis as unknown as { __spendTrackerClient?: Client };

function createDbClient(): Client {
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set — copy .env.example to .env (dev uses file:./local.db, never Turso remote)",
    );
  }
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

// Cache on globalThis so dev HMR re-evals reuse the same client (research 09 §3.4).
const client = globalForDb.__spendTrackerClient ?? createDbClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__spendTrackerClient = client;
}

export const db = drizzle(client, { schema });
