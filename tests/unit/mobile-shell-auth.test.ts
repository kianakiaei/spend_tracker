import { describe, expect, it, vi } from "vitest";

// Expo-mobile ticket 02 (shell + auth): the mobile core is pure TypeScript
// with injected seams (fetch + storage), so it is tested here at the highest
// seam — what the wire carries and what the store holds — never component
// internals. The Expo Router screens in apps/mobile/app are thin wrappers
// over this core.

import {
  loadMobileConfig,
  resolveApiBaseUrl,
  resolveAuthBaseUrl,
} from "../../apps/mobile/src/config";
import {
  MOBILE_TOKEN_KEY,
  createAuthHeaderSupplier,
  createKeyValueTokenStore,
  createMemoryTokenStore,
} from "../../apps/mobile/src/token-store";
import {
  MOBILE_AUTH_MESSAGES,
  MobileAuthError,
  createMobileAuthClient,
} from "../../apps/mobile/src/auth-client";
import {
  MOBILE_AUTH_ROUTES,
  MOBILE_STACK_ROUTES,
  MOBILE_TABS,
  WELCOME_ROUTE,
} from "../../apps/mobile/src/routes";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function mockFetch(
  respond: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return respond(String(input), calls[calls.length - 1]!.init);
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe("mobile config (ticket 02)", () => {
  it("prefers an explicit base URL over env over the same-origin default", () => {
    expect(resolveApiBaseUrl("https://api.example.com/api/v1")).toBe(
      "https://api.example.com/api/v1",
    );
    expect(
      resolveApiBaseUrl(undefined, { EXPO_PUBLIC_API_URL: "https://prod.example.com/api/v1" }),
    ).toBe("https://prod.example.com/api/v1");
    expect(resolveApiBaseUrl(undefined, {})).toBe("/api/v1");
  });

  it("trims a trailing slash from the base URL", () => {
    expect(resolveApiBaseUrl("https://api.example.com/api/v1/")).toBe(
      "https://api.example.com/api/v1",
    );
  });

  it("derives the auth base from the v1 API base (frozen /api/auth mount)", () => {
    expect(resolveAuthBaseUrl("/api/v1")).toBe("/api/auth");
    expect(resolveAuthBaseUrl("https://api.example.com/api/v1")).toBe(
      "https://api.example.com/api/auth",
    );
  });

  it("loads both bases together", () => {
    expect(loadMobileConfig({ EXPO_PUBLIC_API_URL: "https://h.example.com/api/v1" })).toEqual({
      apiBaseUrl: "https://h.example.com/api/v1",
      authBaseUrl: "https://h.example.com/api/auth",
    });
  });
});

describe("mobile token store (ticket 02)", () => {
  it("persists a token across reads until cleared", async () => {
    const store = createMemoryTokenStore();
    await expect(store.getToken()).resolves.toBeNull();
    await store.setToken("token-1");
    await expect(store.getToken()).resolves.toBe("token-1");
    await store.clearToken();
    await expect(store.getToken()).resolves.toBeNull();
  });

  it("starts from a preloaded token (restart restore)", async () => {
    const store = createMemoryTokenStore("restored-token");
    await expect(store.getToken()).resolves.toBe("restored-token");
  });

  it("adapts any key-value storage behind one key", async () => {
    const backing = new Map<string, string>();
    const storage = {
      getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    };
    const store = createKeyValueTokenStore(storage);
    await store.setToken("abc");
    expect(backing.get(MOBILE_TOKEN_KEY)).toBe("abc");
    await expect(store.getToken()).resolves.toBe("abc");
    await store.clearToken();
    expect(backing.has(MOBILE_TOKEN_KEY)).toBe(false);
  });

  it("supplies the Bearer header for the v1 client, empty when signed out", async () => {
    const store = createMemoryTokenStore();
    const headers = createAuthHeaderSupplier(store);
    await expect(headers()).resolves.toEqual({});
    await store.setToken("token-1");
    await expect(headers()).resolves.toEqual({ authorization: "Bearer token-1" });
  });
});

describe("mobile auth client (ticket 02)", () => {
  const user = { id: "user-1", email: "a@example.com" };

  it("signs in, persisting the bearer token from set-auth-token", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe("/api/auth/sign-in/email");
      return jsonResponse({ user }, 200, { "set-auth-token": "bearer-1" });
    });
    const store = createMemoryTokenStore();
    const client = createMobileAuthClient({ fetchFn, tokenStore: store });
    await expect(client.signIn({ email: "a@example.com", password: "correct-password-123" })).resolves.toEqual({ user });
    await expect(store.getToken()).resolves.toBe("bearer-1");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ email: "a@example.com", password: "correct-password-123" });
  });

  it("blocks unverified sign-in with a clear code and stores nothing, then resends", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      if (url.endsWith("/sign-in/email"))
        return jsonResponse({ code: "EMAIL_NOT_VERIFIED", message: "Email not verified" }, 403);
      return jsonResponse({ status: true }, 200);
    });
    const store = createMemoryTokenStore();
    const client = createMobileAuthClient({ fetchFn, tokenStore: store });
    const error = await client.signIn({ email: "u@example.com", password: "correct-password-123" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MobileAuthError);
    expect((error as MobileAuthError).code).toBe("unverified");
    expect(MOBILE_AUTH_MESSAGES.unverified).toContain("تأیید");
    await expect(store.getToken()).resolves.toBeNull();
    await client.resendVerification({ email: "u@example.com" });
    expect(calls[1]!.url).toBe("/api/auth/send-verification-email");
  });

  it("maps wrong credentials to the generic invalid-credentials voice", async () => {
    const { fetchFn } = mockFetch(() =>
      jsonResponse({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }, 401),
    );
    const client = createMobileAuthClient({ fetchFn, tokenStore: createMemoryTokenStore() });
    const error = await client.signIn({ email: "a@example.com", password: "wrong" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MobileAuthError);
    expect((error as MobileAuthError).code).toBe("invalid-credentials");
    expect(MOBILE_AUTH_MESSAGES["invalid-credentials"]).toBe("ایمیل یا رمز اشتباه است");
  });

  it("signs up without a session (verification gate) and normalizes the email", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe("/api/auth/sign-up/email");
      return jsonResponse({ user }, 200);
    });
    const store = createMemoryTokenStore();
    const client = createMobileAuthClient({ fetchFn, tokenStore: store });
    await expect(
      client.signUp({ email: "  New@Example.com ", password: "brand-new-123" }),
    ).resolves.toEqual({ needsVerification: true });
    await expect(store.getToken()).resolves.toBeNull();
    expect(JSON.parse(String(calls[0]!.init.body)).email).toBe("new@example.com");
  });

  it("never stores a session at sign-up, even if a token is echoed back", async () => {
    const { fetchFn } = mockFetch(() => jsonResponse({ user }, 200, { "set-auth-token": "stray" }));
    const store = createMemoryTokenStore();
    const client = createMobileAuthClient({ fetchFn, tokenStore: store });
    await expect(
      client.signUp({ email: "n@example.com", password: "brand-new-123" }),
    ).resolves.toEqual({ needsVerification: true });
    await expect(store.getToken()).resolves.toBeNull();
  });

  it("surfaces resend and forgot-request failures instead of false success notes", async () => {
    const { fetchFn } = mockFetch(() => new Response("<html>crash</html>", { status: 502 }));
    const client = createMobileAuthClient({ fetchFn, tokenStore: createMemoryTokenStore() });
    await expect(client.resendVerification({ email: "u@example.com" })).rejects.toBeInstanceOf(
      MobileAuthError,
    );
    await expect(client.requestPasswordReset({ email: "u@example.com" })).rejects.toBeInstanceOf(
      MobileAuthError,
    );
  });

  it("requests a reset generically with a normalized email", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe("/api/auth/request-password-reset");
      return jsonResponse({ status: true }, 200);
    });
    const client = createMobileAuthClient({ fetchFn, tokenStore: createMemoryTokenStore() });
    await client.requestPasswordReset({ email: "  User@Example.com " });
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      email: "user@example.com",
      redirectTo: "/reset-password",
    });
  });

  it("rejects a bad reset token with the invalid-link voice, accepts a valid one", async () => {
    const { fetchFn } = mockFetch(() => jsonResponse({ code: "INVALID_TOKEN" }, 400));
    const client = createMobileAuthClient({ fetchFn, tokenStore: createMemoryTokenStore() });
    const error = await client.resetPassword({ newPassword: "brand-new-123", token: "bad" }).catch((e: unknown) => e);
    expect((error as MobileAuthError).code).toBe("invalid-token");
    expect(MOBILE_AUTH_MESSAGES["invalid-token"]).toContain("منقضی");

    const ok = mockFetch(() => jsonResponse({ status: true }, 200));
    const clientOk = createMobileAuthClient({ fetchFn: ok.fetchFn, tokenStore: createMemoryTokenStore() });
    await clientOk.resetPassword({ newPassword: "brand-new-123", token: "good" });
    expect(ok.calls[0]!.url).toBe("/api/auth/reset-password");
  });

  it("serves the session over Bearer and returns null when signed out without a fetch", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ user }, 200));
    const signedOut = createMobileAuthClient({ fetchFn, tokenStore: createMemoryTokenStore() });
    await expect(signedOut.getSession()).resolves.toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();

    const store = createMemoryTokenStore("bearer-1");
    const { calls, fetchFn: authedFetch } = mockFetch(() => jsonResponse({ user }, 200));
    const signedIn = createMobileAuthClient({ fetchFn: authedFetch, tokenStore: store });
    await expect(signedIn.getSession()).resolves.toEqual({ user });
    expect(calls[0]!.url).toBe("/api/auth/get-session");
    expect(calls[0]!.init.headers).toMatchObject({ authorization: "Bearer bearer-1" });
  });

  it("signs out against the server and always clears the local token", async () => {
    const { calls, fetchFn } = mockFetch((url) => {
      expect(url).toBe("/api/auth/sign-out");
      return jsonResponse({ status: true }, 200);
    });
    const store = createMemoryTokenStore("bearer-1");
    await createMobileAuthClient({ fetchFn, tokenStore: store }).signOut();
    await expect(store.getToken()).resolves.toBeNull();
    expect(calls[0]!.init.headers).toMatchObject({ authorization: "Bearer bearer-1" });

    const failing = createMobileAuthClient({
      fetchFn: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch,
      tokenStore: createMemoryTokenStore("bearer-1"),
    });
    await failing.signOut();
    await expect(failing.getToken()).resolves.toBeNull();
  });

  it("surfaces network faults as the platform TypeError", async () => {
    const client = createMobileAuthClient({
      fetchFn: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch,
      tokenStore: createMemoryTokenStore(),
    });
    await expect(client.signIn({ email: "a@example.com", password: "x" })).rejects.toThrow(TypeError);
  });
});

describe("mobile shell routes (tickets 02 + 10 + 12)", () => {
  it("exposes five bottom tabs: Home, Categories, Events, Templates, Insights", () => {
    expect(MOBILE_TABS.map((t) => t.name)).toEqual([
      "index",
      "categories",
      "events",
      "templates",
      "insights",
    ]);
  });

  it("exposes stack screens for the drilldowns plus search", () => {
    expect(MOBILE_STACK_ROUTES).toEqual([
      "category/[id]",
      "event/[id]",
      "search",
    ]);
  });

  it("exposes the four in-app auth screens", () => {
    expect(MOBILE_AUTH_ROUTES).toEqual([
      "(auth)/sign-in",
      "(auth)/sign-up",
      "(auth)/forgot",
      "(auth)/reset",
    ]);
  });

  it("lands `/` on the welcome screen, never on reset", () => {
    expect(WELCOME_ROUTE).toBe("index");
    expect(MOBILE_AUTH_ROUTES).not.toContain(WELCOME_ROUTE);
  });
});
