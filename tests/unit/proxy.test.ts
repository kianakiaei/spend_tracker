import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

// The optimistic cookie-presence gate (ticket 08/25): cookie-less browsers
// bounce to /login, cookie-bearing requests pass. The handlers and RSC
// guards — not this file — are the authority on sessions.

const SESSION_COOKIE = "better-auth.session_token"; // better-auth's default name

function requestAt(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy — optimistic redirect to /login", () => {
  it("redirects a cookie-less browser request to /login", () => {
    const res = proxy(requestAt("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("redirects when other cookies ride along but the session cookie is absent", () => {
    const res = proxy(requestAt("/1405-07", "other=1"));
    expect(res.status).toBe(307);
  });

  it("passes requests that carry a session cookie (presence, not validation)", () => {
    const res = proxy(requestAt("/", `${SESSION_COOKIE}=whatever`));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy matcher — the deliberate exceptions", () => {
  // Next strips the matcher's leading slash and regex-tests the path minus
  // its leading slash, anchored; the negative lookahead then decides. This
  // mirrors that evaluation closely enough to pin WHICH paths are gated.
  const pattern = new RegExp(`^${config.matcher[0]!.slice(1)}$`);
  const proxied = (path: string) => pattern.test(path.replace(/^\//, ""));

  it("gates pages but never the v1 API (handlers answer their own 401), better-auth's mount, the public auth pages, or static assets", () => {
    const excluded = [
      "/api/v1/expenses",
      "/api/v1/categories/abc/move-expenses",
      "/api/auth/sign-in/email",
      "/login",
      "/forgot-password",
      "/reset-password",
      "/_next/static/chunk.js",
      "/_next/image?q=80",
      "/favicon.ico",
      "/robots.txt",
      "/sitemap.xml",
      "/manifest.json",
      "/logo.svg",
      "/fonts/Vazirmatn.woff2",
    ];
    const included = ["/", "/categories", "/templates", "/1405-07"];

    for (const path of excluded) {
      expect(proxied(path), `${path} must be excluded`).toBe(false);
    }
    for (const path of included) {
      expect(proxied(path), `${path} must be gated`).toBe(true);
    }
  });

  it("routes /api/* through the proxy too (dev CORS lives there, never a login redirect)", () => {
    const apiPattern = new RegExp(
      `^${config.matcher[1]!.replace(":path*", ".*")}$`,
    );
    const proxiedApi = (path: string) => apiPattern.test(path);
    for (const path of ["/api/v1/expenses", "/api/auth/sign-in/email"]) {
      expect(proxiedApi(path), `${path} must reach the proxy`).toBe(true);
    }
    for (const path of ["/", "/login", "/categories"]) {
      expect(proxiedApi(path), `${path} must not match the api entry`).toBe(false);
    }
  });
});

describe("proxy dev CORS for expo web (localhost:8081)", () => {
  const EXPO_WEB_ORIGIN = "http://localhost:8081";

  function corsRequest(path: string, method: string, origin?: string): NextRequest {
    return new NextRequest(`http://localhost:3000${path}`, {
      method,
      headers: origin ? { origin } : {},
    });
  }

  function withDevEnv(fn: () => void): void {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = "development";
    try {
      fn();
    } finally {
      env.NODE_ENV = previous;
    }
  }

  it("answers preflights from expo web with 204 plus CORS headers", () => {
    withDevEnv(() => {
      const res = proxy(corsRequest("/api/v1/expenses", "OPTIONS", EXPO_WEB_ORIGIN));
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe(EXPO_WEB_ORIGIN);
      expect(res.headers.get("access-control-allow-methods")).toContain("POST");
      expect(res.headers.get("access-control-allow-headers")).toContain("Authorization");
    });
  });

  it("passes real API calls from expo web through (CORS headers, never a login redirect)", () => {
    withDevEnv(() => {
      const res = proxy(corsRequest("/api/v1/expenses", "GET", EXPO_WEB_ORIGIN));
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(res.headers.get("access-control-allow-origin")).toBe(EXPO_WEB_ORIGIN);
      expect(res.headers.get("location")).toBeNull();
    });
  });

  it("leaves foreign origins and non-API paths without CORS headers", () => {
    withDevEnv(() => {
      const foreign = proxy(corsRequest("/api/v1/expenses", "OPTIONS", "https://evil.example"));
      expect(foreign.status).toBe(204);
      expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
      const page = proxy(corsRequest("/", "OPTIONS", EXPO_WEB_ORIGIN));
      expect(page.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  it("stays off outside development (production wire unchanged)", () => {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      const res = proxy(corsRequest("/api/v1/expenses", "OPTIONS", EXPO_WEB_ORIGIN));
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      env.NODE_ENV = previous;
    }
  });
});

describe("proxy never login-redirects the API (mobile Bearer crash)", () => {
  // Production regression: the phone carries no session cookie, so the old
  // fall-through bounced every /api call 307 → /login, fetch followed into
  // 200 HTML, and the typed client died with "Unexpected character: <".
  // Handlers own auth (401 problem+json); the proxy just passes through.
  function withProdEnv(fn: () => void): void {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      fn();
    } finally {
      env.NODE_ENV = previous;
    }
  }

  it("passes cookieless API calls through in production (no redirect)", () => {
    withProdEnv(() => {
      for (const path of ["/api/v1/expenses", "/api/auth/get-session"]) {
        const res = proxy(requestAt(path));
        expect(res.headers.get("x-middleware-next")).toBe("1");
        expect(res.headers.get("location")).toBeNull();
      }
    });
  });

  it("answers API preflights in production with bare 204 (no redirect, no CORS)", () => {
    withProdEnv(() => {
      const res = proxy(
        new NextRequest("http://localhost:3000/api/v1/expenses", {
          method: "OPTIONS",
          headers: { origin: "http://localhost:8081" },
        }),
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  it("still bounces cookie-less page loads to /login in production", () => {
    withProdEnv(() => {
      const res = proxy(requestAt("/"));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    });
  });
});
