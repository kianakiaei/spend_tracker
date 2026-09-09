import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

// Ticket 30: every e2e run starts from a FRESH database — all rows wiped,
// then migrated — so month-nav assertions («past month empty») and the
// shared setup user never collide with a previous run. Rows (not the file)
// are deleted because Windows keeps the file locked while a previous
// server's libSQL client closes late — unlinking EBUSYs. This runs BEFORE
// the webServer boots (Playwright globalSetup order), against the same
// file the server serves via webServer.env.
export default async function globalSetup() {
  const dbPath = join(process.cwd(), "e2e-test.db");
  const client = createClient({ url: `file:${dbPath}` });
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  // Children before parents (FKs stay off in libSQL, but order is honest).
  for (const table of [
    "verification",
    "session",
    "account",
    "learnedKeys",
    "expenses",
    "recurringTemplates",
    "categories",
    "user",
  ]) {
    await client.execute(`DELETE FROM "${table}"`);
  }
  await client.close();
}
