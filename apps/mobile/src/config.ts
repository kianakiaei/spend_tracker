// Mobile base-URL config (expo-mobile ticket 02).
//
// The app talks only to the frozen versioned HTTP API plus the existing
// /api/auth mount — no new endpoints. The base URL is configurable so local
// dev and production point at the right backend: an explicit value wins,
// then EXPO_PUBLIC_API_URL, then the same-origin web default.

export interface MobileEnv {
  EXPO_PUBLIC_API_URL?: string;
}

export interface MobileConfig {
  apiBaseUrl: string;
  authBaseUrl: string;
}

const DEFAULT_API_BASE_URL = "/api/v1";

function trimTrailingSlash(value: string): string {
  return value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
}

/** Resolve the v1 API base: explicit > EXPO_PUBLIC_API_URL > same-origin. */
export function resolveApiBaseUrl(explicit?: string, env?: MobileEnv): string {
  const fromEnv =
    env?.EXPO_PUBLIC_API_URL ??
    (typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_API_URL : undefined);
  const raw = (explicit ?? fromEnv ?? DEFAULT_API_BASE_URL).trim();
  return trimTrailingSlash(raw || DEFAULT_API_BASE_URL);
}

/** Derive the better-auth mount from the v1 API base (/api/v1 -> /api/auth). */
export function resolveAuthBaseUrl(apiBaseUrl: string): string {
  const base = trimTrailingSlash(apiBaseUrl.trim() || DEFAULT_API_BASE_URL);
  if (base.endsWith("/v1")) return `${base.slice(0, -"/v1".length)}/auth`;
  return `${base}/auth`;
}

/** Load both bases together from env / explicit overrides. */
export function loadMobileConfig(
  env?: MobileEnv,
  explicitApiBaseUrl?: string,
): MobileConfig {
  const apiBaseUrl = resolveApiBaseUrl(explicitApiBaseUrl, env);
  return { apiBaseUrl, authBaseUrl: resolveAuthBaseUrl(apiBaseUrl) };
}
