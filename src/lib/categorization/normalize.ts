// Re-export of the shared Persian normalizer (expo-mobile ticket 01).
// @spend-tracker/shared is the single source of truth; this module stays
// so existing `@/lib/categorization/normalize` imports keep working.
export * from "@spend-tracker/shared/normalize";
