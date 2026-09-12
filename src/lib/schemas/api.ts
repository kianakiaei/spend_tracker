// Re-export of the shared v1 DTO shapes (expo-mobile ticket 01).
// @spend-tracker/shared is the single source of truth; this module stays
// so existing `@/lib/schemas/api` imports keep working with zero change.
export * from "@spend-tracker/shared/schemas/api";
