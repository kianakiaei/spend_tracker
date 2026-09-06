import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!, // dev: file:./local.db | prod: libsql://…
    authToken: process.env.TURSO_AUTH_TOKEN, // undefined is fine for local files
  },
});
