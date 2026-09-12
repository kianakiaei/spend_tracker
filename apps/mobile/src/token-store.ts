// Universal token store (expo-mobile ticket 02, spec: "one universal token
// store: secure storage on native, browser storage on web, behind one
// get/set contract, fed into the client header supplier").
//
// This module is pure: platform adapters (SecureStore / localStorage) live in
// apps/mobile/src/storage.ts and are injected here as a KeyValueStorage, so
// this contract is unit-testable with no native dependencies. The header
// supplier plugs straight into createV1Client({ headers }) from
// @spend-tracker/shared.

/** Storage key under which the bearer token persists across restarts. */
export const MOBILE_TOKEN_KEY = "spend-tracker.auth-token";

/** The one token contract every platform adapter implements. */
export interface TokenStore {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
}

/** Minimal key-value surface (SecureStore and localStorage both adapt). */
export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/** In-memory store: the test double and the fallback when no adapter exists. */
export function createMemoryTokenStore(initialToken?: string | null): TokenStore {
  let token: string | null = initialToken ?? null;
  return {
    getToken: async () => token,
    setToken: async (next: string) => {
      token = next;
    },
    clearToken: async () => {
      token = null;
    },
  };
}

/** Adapt any key-value storage (SecureStore on native, localStorage on web). */
export function createKeyValueTokenStore(
  storage: KeyValueStorage,
  key: string = MOBILE_TOKEN_KEY,
): TokenStore {
  return {
    getToken: async () => storage.getItem(key),
    setToken: async (token: string) => void (await storage.setItem(key, token)),
    clearToken: async () => void (await storage.removeItem(key)),
  };
}

/** Per-call header supplier for the shared v1 client (the mobile Bearer path). */
export function createAuthHeaderSupplier(
  store: TokenStore,
): () => Promise<Record<string, string>> {
  return async (): Promise<Record<string, string>> => {
    const token = await store.getToken();
    const headers: Record<string, string> = {};
    if (token) headers["authorization"] = `Bearer ${token}`;
    return headers;
  };
}
