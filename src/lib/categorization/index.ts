export { canonical } from "./normalize";
export { extractKeys, STOPWORDS } from "./keys";
export { createCategorizer, learn, decay } from "./engine";
export type {
  LearnedKeyRecord,
  UserCategoryRef,
  Suggestion,
  SuggestionConfidence,
  SuggestionSource,
  Categorizer,
  CategorizerInput,
} from "./engine";
export { SEED_LEXICON, SYSTEM_CATEGORIES } from "./seed-lexicon";
export type { SeedCategory, SystemCategorySlug } from "./seed-lexicon";
