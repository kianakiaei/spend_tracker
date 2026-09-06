import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The db client reads TURSO_DATABASE_URL at module init, so the env must be
// set before the first dynamic import below. Vitest forks + isolation keep
// this file's env/module registry separate from other test files.
const dbUrl = `file:${join(tmpdir(), `auth-smoke-${randomUUID()}.db`)}`;
process.env.TURSO_DATABASE_URL = dbUrl;

const { createClient } = await import("@libsql/client");
const { drizzle } = await import("drizzle-orm/libsql");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { auth } = await import("@/lib/auth");

const ORIGIN = "http://localhost:3000";
const EMAIL = "smoke@example.com";
const PASSWORD = "test-password-123";

function handlerRequest(path: string, init?: RequestInit): Request {
  return new Request(`${ORIGIN}${path}`, init);
}

function signInRequest(): Request {
  return handlerRequest("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
}

/** Asserts the response carries a better-auth session cookie and returns it
 * as a Cookie header value. */
function assertSessionCookieFrom(res: Response): string {
  const cookies = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  expect(cookies, "expected a session cookie").toContain("session_token");
  return cookies;
}

describe("better-auth smoke on local libSQL (ticket 18)", () => {
  const client = createClient({ url: dbUrl });

  beforeAll(async () => {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  });

  afterAll(async () => {
    await client.close();
  });

  it("signs up a user and sets a session cookie", async () => {
    const res = await auth.handler(
      handlerRequest("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "کاربر آزمون",
          email: EMAIL,
          password: PASSWORD,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user?: { email?: string } };
    expect(body.user?.email).toBe(EMAIL);
    assertSessionCookieFrom(res);
  });

  it("serves get-session to the cookie path", async () => {
    const signIn = await auth.handler(signInRequest());
    expect(signIn.status).toBe(200);
    const cookie = assertSessionCookieFrom(signIn);

    const res = await auth.handler(
      handlerRequest("/api/auth/get-session", {
        headers: { cookie },
      }),
    );
    expect(res.status).toBe(200);
    const session = (await res.json()) as { user?: { email?: string } };
    expect(session.user?.email).toBe(EMAIL);
  });

  it("sign-in exposes the mobile bearer path (set-auth-token + Bearer get-session)", async () => {
    const signIn = await auth.handler(signInRequest());
    expect(signIn.status).toBe(200);
    const token = signIn.headers.get("set-auth-token");
    expect(token, "bearer plugin must expose set-auth-token").toBeTruthy();

    const res = await auth.handler(
      handlerRequest("/api/auth/get-session", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
    const session = (await res.json()) as { user?: { email?: string } };
    expect(session.user?.email).toBe(EMAIL);
  });

  it("returns a null session without credentials", async () => {
    const res = await auth.handler(
      handlerRequest("/api/auth/get-session"),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toBeNull();
  });
});
