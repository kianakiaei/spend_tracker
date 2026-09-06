import { and, asc, count, eq } from "drizzle-orm";
import { categories, expenses } from "@/db/schema";
import { titleSchema } from "@/lib/schemas";
import { ValidationError } from "./errors";
import { loadCategorizerState } from "./categorizer-state";
import type { Category, DomainDb } from "./types";

// The shared classify service (ticket 22): the pure ticket-21 engine over the
// user's learned counters + the system lexicon, plus the ticket-06 fallback —
// most-frequent category of the user; first system category (خوراکی) for a
// user without history. Source of the live form suggestion (ticket 27) and of
// the side-effect-free POST /api/v1/classify endpoint (ticket 25): learning
// only ever happens on expense saves.

export type ClassifySource = "learned" | "system" | "fallback";

export interface ClassifyResult {
  categoryId: string;
  source: ClassifySource;
  /** The canonical key that scored the hit; null for a fallback answer. */
  matchedKey: string | null;
  /** purity × support of the counters behind a learned hit; null otherwise
   * (ticket 06: reported, never a decision gate). */
  confidence: { purity: number; support: number } | null;
}

export interface ClassifyService {
  classify(userId: string, title: string): Promise<ClassifyResult>;
}

export function createClassifyService(db: DomainDb): ClassifyService {
  return {
    async classify(userId, title) {
      const parsed = titleSchema.safeParse(title);
      if (!parsed.success) {
        throw new ValidationError(
          "invalid classify input",
          parsed.error.issues,
        );
      }

      const { categorizer } = await loadCategorizerState(db, userId);
      const suggestion = categorizer.classify(parsed.data);
      if (suggestion) {
        return {
          categoryId: suggestion.categoryId,
          source: suggestion.source,
          matchedKey: suggestion.matchedKey,
          confidence: suggestion.confidence,
        };
      }

      const fallback = await mostFrequentCategory(db, userId);
      return {
        categoryId: fallback.id,
        source: "fallback",
        matchedKey: null,
        confidence: null,
      };
    },
  };
}

/** Most expenses wins; ties break by the user's category order — same
 * determinism rule as the engine's learned-counter tie-break. */
async function mostFrequentCategory(db: DomainDb, userId: string): Promise<Category> {
  const rows = await db
    .select({
      id: expenses.categoryId,
      total: count(),
      order: categories.order,
    })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .where(eq(expenses.userId, userId))
    .groupBy(expenses.categoryId);
  rows.sort((a, b) => b.total - a.total || a.order - b.order);
  if (rows[0]) {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, rows[0].id))
      .limit(1);
    if (category) return category;
  }

  // No expense history: the first system category (خوراکی) — always present,
  // seeded at registration (ticket 06).
  const [firstSystem] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.kind, "system")))
    .orderBy(asc(categories.order))
    .limit(1);
  if (!firstSystem) {
    throw new ValidationError("user has no categories to fall back to");
  }
  return firstSystem;
}
