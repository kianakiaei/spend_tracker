import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Duplicate sign-up (owner-warning): with requireEmailVerification,
// better-auth answers a taken email with a generic 200 + phantom user
// (anti-enumeration — no row, no verification mail). The one observable
// server-side effect must be the security warning to the real owner, and
// the existing account must keep working untouched.

// The db client reads TURSO_DATABASE_URL at module init, so the env must be
// set before the first dynamic import below. Vitest forks + isolation keep
// this file's env/module registry separate from other test files.
const dbUrl = `file:${join(tmpdir(), `auth-dupe-${randomUUID()}.db`)}`;
process.env.TURSO_DATABASE_URL = dbUrl;

const { createClient } = await import("@libsql/client");
const { drizzle } = await import("drizzle-orm/libsql");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { auth } = await import("@/lib/auth");
const { captureConsoleLines, emailedUrl, verifyEmail } = await import(
  "../helpers/verify-email"
);

const ORIGIN = "http://localhost:3000";
const EMAIL = "dupe-owner@example.com";
const PASSWORD = "test-password-123";

function signUpRequest(): Request {
  return new Request(`${ORIGIN}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "dupe", email: EMAIL, password: PASSWORD }),
  });
}

describe("duplicate sign-up warns the owner and leaves the account alone", () => {
  const client = createClient({ url: dbUrl });

  beforeAll(async () => {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  });

  afterAll(async () => {
    await client.close();
  });

  let firstId = "";
  let verifyUrl = "";

  it("creates the account on first sign-up", async () => {
    const { lines, restore } = captureConsoleLines();
    try {
      const res = await auth.handler(signUpRequest());
      expect(res.status).toBe(200);
      const body = (await res.json()) as { user: { id: string } };
      firstId = body.user.id;
      verifyUrl = emailedUrl(lines, "verification");
    } finally {
      restore();
    }
  });

  it("answers a repeat sign-up generically: 200 phantom user, one row, owner warned", async () => {
    const { lines, restore } = captureConsoleLines();
    try {
      const res = await auth.handler(signUpRequest());
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        token: null;
        user: { id: string; email: string };
      };
      // Phantom: same shape, but not a persisted user.
      expect(body.token).toBeNull();
      expect(body.user.email).toBe(EMAIL);
      expect(body.user.id).not.toBe(firstId);

      const count = await client.execute({
        sql: "SELECT COUNT(*) AS n FROM user WHERE email = ?",
        args: [EMAIL],
      });
      expect(Number(count.rows[0]!.n)).toBe(1);

      expect(lines.join("\n")).toContain(
        `[auth] duplicate sign-up warning for ${EMAIL}`,
      );
    } finally {
      restore();
    }
  });

  it("the original account still verifies and signs in with its password", async () => {
    const { cookie, status } = await verifyEmail(auth, verifyUrl);
    expect(status, "verify link redirects").toBe(302);
    expect(cookie, "expected a session cookie").toContain("session_token");

    const signIn = await auth.handler(
      new Request(`${ORIGIN}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      }),
    );
    expect(signIn.status).toBe(200);
  });
});
