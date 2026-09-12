// @spend-tracker/shared — the one pure package both web and Expo mobile
// consume (expo-mobile spec: no web-only or native-only dependencies here,
// only zod + date-fns-jalali + built-in Intl). The frozen v1 wire shapes and
// the typed client are the single programmatic path to the versioned API.

export * from "./schemas/index";
export * from "./api/problem-body";
export { ApiError, api, createV1Client } from "./api/client";
export type { V1Client, V1ClientOptions } from "./api/client";
export * from "./jalali";
export * from "./normalize";
export * from "./format";
export * from "./quantity";
