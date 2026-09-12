// Re-export of the shared problem+json wire shape (expo-mobile ticket 01).
// @spend-tracker/shared is the single source of truth; this module stays
// so existing `@/lib/api/problem-body` imports keep working with zero change.
export * from "@spend-tracker/shared/api/problem-body";
