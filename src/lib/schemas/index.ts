// Re-export of the shared schemas entry (expo-mobile ticket 01).
// @spend-tracker/shared is the single source of truth; this module stays
// so existing `@/lib/schemas` imports keep working with zero change.
export * from "@spend-tracker/shared/schemas";
