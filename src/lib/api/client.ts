// Re-export of the shared typed v1 client (expo-mobile ticket 01).
// @spend-tracker/shared is the single source of truth; this module stays
// so existing `@/lib/api/client` imports keep working with zero change.
export * from "@spend-tracker/shared/api/client";
