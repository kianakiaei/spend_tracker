import { learnedKeys } from "@/db/schema";
import { decay, learn, type LearnedKeyRecord } from "@/lib/categorization";
import { loadCategorizerState } from "./categorizer-state";
import type { DomainDb } from "./types";

// Learning on save (ticket 06 rules, ticket 22 writes): every expense save
// (create/update) with final category X counts the title's normalized keys
// toward X; when the save contradicts what the engine suggested, the
// suggested category's counters for those keys halve (×0.5, a soft revoke —
// never a delete). Deleting an expense never unlearns.

export async function learnOnSave(
  db: DomainDb,
  userId: string,
  title: string,
  finalCategoryId: string,
): Promise<void> {
  const now = new Date();
  // The contradiction check runs against the PRE-save counters — classify
  // first, decay second, learn last.
  const { categorizer, learnedRows } = await loadCategorizerState(db, userId);
  const suggestion = categorizer.classify(title);

  let rows = learnedRows;
  if (suggestion && suggestion.categoryId !== finalCategoryId) {
    const decayed = decay(rows, title, suggestion.categoryId);
    await writeCounterDiffs(db, userId, rows, decayed, now);
    rows = decayed;
  }

  const learned = learn(rows, title, finalCategoryId);
  await writeCounterDiffs(db, userId, rows, learned, now);
}

/** Turns the engine's pure row-state diff into (userId, key, categoryId)
 * upserts — only rows whose count actually moved are written. Fractional
 * counts after decay (3 → 1.5) ride along; SQLite keeps them as REAL under
 * the INTEGER column. */
async function writeCounterDiffs(
  db: DomainDb,
  userId: string,
  before: readonly LearnedKeyRecord[],
  after: readonly LearnedKeyRecord[],
  now: Date,
): Promise<void> {
  const beforeCount = new Map(
    before.map((row) => [counterId(row.key, row.categoryId), row.count]),
  );
  for (const row of after) {
    if (beforeCount.get(counterId(row.key, row.categoryId)) === row.count) {
      continue;
    }
    await db
      .insert(learnedKeys)
      .values({
        key: row.key,
        categoryId: row.categoryId,
        count: row.count,
        userId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [learnedKeys.userId, learnedKeys.key, learnedKeys.categoryId],
        set: { count: row.count, updatedAt: now },
      });
  }
}

function counterId(key: string, categoryId: string): string {
  return `${key}\u0000${categoryId}`;
}
