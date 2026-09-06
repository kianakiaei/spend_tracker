import { createCategorizer, SEED_LEXICON } from "./index";
import type { LearnedKeyRecord, UserCategoryRef } from "./index";

// The client-side composition of the pure ticket-21 engine (ticket 27): the
// expense sheet's live suggestion runs HERE in the browser — lexicon,
// learned keys and categories all arrive as props from the server render and
// sit in memory, so each answer is a pure function call (microseconds, no
// POST while typing — ticket 06). The one thing it adds to the ladder is the
// fallback answer: the engine's null rung becomes the fallback category the
// server precomputed at page load (most-frequent; first system category for
// a user without history — ticket 06), so «همیشه پیشنهاد» never blanks.

export type SuggestionAnswerSource = "learned" | "system" | "fallback";

export interface SuggestionAnswer {
  categoryId: string;
  source: SuggestionAnswerSource;
}

export interface SuggestionEngineInput {
  categories: readonly UserCategoryRef[];
  learnedKeys: readonly LearnedKeyRecord[];
  /** The classify-service fallback answer, computed server-side at page
   * load (getFallbackCategory, ticket 22's rule). */
  fallbackCategoryId: string;
}

export interface ClientSuggestionEngine {
  /** Never null — a no-guess title is answered by the fallback. */
  classify(title: string): SuggestionAnswer;
}

export function createSuggestionEngine(
  input: SuggestionEngineInput,
): ClientSuggestionEngine {
  const categorizer = createCategorizer({
    lexicon: SEED_LEXICON,
    learnedKeys: input.learnedKeys,
    categories: input.categories,
  });
  return {
    classify(title) {
      const hit = categorizer.classify(title);
      if (hit) return { categoryId: hit.categoryId, source: hit.source };
      return { categoryId: input.fallbackCategoryId, source: "fallback" };
    },
  };
}
