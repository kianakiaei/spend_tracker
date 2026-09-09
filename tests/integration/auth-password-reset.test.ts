import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dbUrl = `file:${join(tmpdir(), `auth-reset-${randomUUID()}.db`)}`;
process.env.TURSO_DATABASE_URL = dbUrl;

const { createClient } = await import("@libsql/client");
const { drizzle } = await import("drizzle-orm/libsql");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { auth } = await import("@/lib/auth");
const { captureConsoleLines, emailedUrl, verifyEmail } = await import(
  "../helpers/verify-email"
);

const ORIGIN = "http://localhost:3000";
const EMAIL = "reset@example.com";
const PASSWORD = "test-password-123";

function handlerRequest(path: string, init?: RequestInit): Request {
  return new Request(`${ORIGIN}${path}`, init);
}

function jsonPost(path: string, body: unknown): Request {
  return handlerRequest(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("password reset (ticket 29)", () => {
  const client = createClient({ url: dbUrl });

  beforeAll(async () => {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    const { lines, restore } = captureConsoleLines();
    try {
      const res = await auth.handler(
        jsonPost("/api/auth/sign-up/email", {
          name: "کاربر ریست",
          email: EMAIL,
          password: PASSWORD,
        }),
      );
      expect(res.status).toBe(200);
      const { cookie } = await verifyEmail(
        auth,
        emailedUrl(lines, "verification"),
      );
      expect(cookie).toContain("session_token");
    } finally {
      restore();
    }
  });

  afterAll(async () => {
    await client.close();
  });

  it("answers an unknown email with the same generic message (no account enumeration)", async () => {
    const res = await auth.handler(
      jsonPost("/api/auth/request-password-reset", {
        email: "nobody@example.com",
        redirectTo: "/reset-password",
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: boolean; message?: string };
    // The library's English message is generic for unknown emails; the
    // Persian generic voice lives in the UI (forgot-password page).
    expect(body.status).toBe(true);
    expect(typeof body.message).toBe("string");
  });

  it("creates a reset verification for a known email and answers generically", async () => {
    const unknown = (await (
      await auth.handler(
        jsonPost("/api/auth/request-password-reset", {
          email: "nobody@example.com",
          redirectTo: "/reset-password",
        }),
      )
    ).json()) as { message?: string };
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const res = await auth.handler(
        jsonPost("/api/auth/request-password-reset", {
          email: EMAIL,
          redirectTo: "/reset-password",
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status?: boolean; message?: string };
      expect(body.status).toBe(true);
      expect(body.message).toBe(unknown.message);
    } finally {
      log.mockRestore();
    }
  });

  it("rejects sign-in with a wrong password (generic, no session)", async () => {
    const res = await auth.handler(
      jsonPost("/api/auth/sign-in/email", {
        email: EMAIL,
        password: "wrong-password-456",
      }),
    );
    expect(res.status).not.toBe(200);
    expect(res.headers.getSetCookie().join(";")).not.toContain(
      "session_token",
    );
  });

  it("rejects reset with an invalid/expired token", async () => {
    const res = await auth.handler(
      jsonPost("/api/auth/reset-password", {
        newPassword: "brand-new-password-789",
        token: "invalid-token-xyz",
      }),
    );
    expect(res.status).not.toBe(200);
  });

  it("resets with a valid token, then signs in with the new password", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    let url = "";
    try {
      await auth.handler(
        jsonPost("/api/auth/request-password-reset", {
          email: EMAIL,
          redirectTo: "/reset-password",
        }),
      );
      const printed = log.mock.calls.map((c) => String(c[0])).join("\n");
      const match = printed.match(/https?:\/\/\S+/);
      expect(match, "expected the dev reset link in console").toBeTruthy();
      url = match![0];
    } finally {
      log.mockRestore();
    }
    const token = new URL(url).pathname.split("/").pop()!;
    expect(token.length).toBeGreaterThan(10);

    const reset = await auth.handler(
      jsonPost("/api/auth/reset-password", {
        newPassword: "brand-new-password-789",
        token,
      }),
    );
    expect(reset.status).toBe(200);

    const signIn = await auth.handler(
      jsonPost("/api/auth/sign-in/email", {
        email: EMAIL,
        password: "brand-new-password-789",
      }),
    );
    expect(signIn.status).toBe(200);
  });
});
