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

  it("gates pages but never the v1 API (handlers answer their own 401), better-auth's mount, or static assets", () => {
    const excluded = [
      "/api/v1/expenses",
      "/api/v1/categories/abc/move-expenses",
      "/api/auth/sign-in/email",
      "/_next/static/chunk.js",
      "/_next/image?q=80",
      "/favicon.ico",
      "/robots.txt",
      "/sitemap.xml",
      "/manifest.json",
      "/logo.svg",
      "/fonts/Vazirmatn.woff2",
    ];
    const included = ["/", "/login", "/1405-07"];

    for (const path of excluded) {
      expect(proxied(path), `${path} must be excluded`).toBe(false);
    }
    for (const path of included) {
      expect(proxied(path), `${path} must be gated`).toBe(true);
    }
  });
});
