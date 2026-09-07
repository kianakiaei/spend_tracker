import { asc, eq } from "drizzle-orm";
import { categories, learnedKeys } from "@/db/schema";
import {
  createCategorizer,
  SEED_LEXICON,
  type Categorizer,
  type LearnedKeyRecord,
  type UserCategoryRef,
} from "@/lib/categorization";
import type { DomainDb } from "./types";

// The SQL→engine bridge (ticket 22): loads the user's categories and learned
// counters and builds the pure ticket-21 engine over them. Lexicon slug →
// category-UUID resolution happens inside the engine from the passed list —
// SQL stays out of it. classify() and learning (expense saves) both go
// through here.

export interface CategorizerState {
  categorizer: Categorizer;
  /** The user's categories in display order — the engine's ref plus the
   * order used for fallback/learned tie-breaks. */
  categories: Array<UserCategoryRef & { order: number }>;
  /** Raw learnedKeys rows, kept for the learning upserts (learnOnSave). */
  learnedRows: LearnedKeyRecord[];
}

export async function loadCategorizerState(
  db: DomainDb,
  userId: string,
): Promise<CategorizerState> {
  const categoryRows = await listUserCategoryRefs(db, userId);

  const rows = await listLearnedKeys(db, userId);

  const categorizer = createCategorizer({
    lexicon: SEED_LEXICON,
    learnedKeys: rows,
    categories: categoryRows,
  });

  return { categorizer, categories: categoryRows, learnedRows: rows };
}

/** The user's categories in display order — the engine's ref plus the order
 * used for fallback/learned tie-breaks. */
async function listUserCategoryRefs(db: DomainDb, userId: string) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      order: categories.order,
    })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.order), asc(categories.createdAt));
}

/** The user's learned counters, shaped like the engine's records — the RSC
 * hands them to the client-side suggestion engine as props (ticket 27:
 * live suggestion from memory, no POST while typing). */
export async function listLearnedKeys(
  db: DomainDb,
  userId: string,
): Promise<LearnedKeyRecord[]> {
  return db
    .select({
      key: learnedKeys.key,
      categoryId: learnedKeys.categoryId,
      count: learnedKeys.count,
    })
    .from(learnedKeys)
    .where(eq(learnedKeys.userId, userId));
}
