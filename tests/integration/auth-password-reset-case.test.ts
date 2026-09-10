import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dbUrl = `file:${join(tmpdir(), `auth-reset-case-${randomUUID()}.db`)}`;
process.env.TURSO_DATABASE_URL = dbUrl;

const { createClient } = await import("@libsql/client");
const { drizzle } = await import("drizzle-orm/libsql");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { auth } = await import("@/lib/auth");
const { withNormalizedResetEmail } = await import("@/lib/auth-request");
const { captureConsoleLines, emailedUrl, verifyEmail } = await import(
  "../helpers/verify-email"
);

const ORIGIN = "http://localhost:3000";
const EMAIL = "case-reset@example.com";
const PASSWORD = "test-password-123";

function jsonPost(path: string, body: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("password reset with a messy-case email", () => {
  const client = createClient({ url: dbUrl });

  beforeAll(async () => {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    const { lines, restore } = captureConsoleLines();
    try {
      const res = await auth.handler(
        jsonPost("/api/auth/sign-up/email", {
          name: "case reset",
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

  it("still sends the reset link for UPPERCASE / padded input", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const raw = jsonPost("/api/auth/request-password-reset", {
        // Phones and password managers routinely produce this shape.
        email: `  ${EMAIL.toUpperCase()}  `,
        redirectTo: "/reset-password",
      });
      const res = await auth.handler(await withNormalizedResetEmail(raw));
      expect(res.status).toBe(200);
      const printed = log.mock.calls.map((c) => String(c[0])).join("\n");
      expect(printed).toMatch(/password reset link/);
      const match = printed.match(/https?:\/\/\S+/);
      expect(match, "expected the dev reset link in console").toBeTruthy();
      const token = new URL(match![0]).pathname.split("/").pop()!;
      const reset = await auth.handler(
        jsonPost("/api/auth/reset-password", {
          newPassword: "brand-new-password-789",
          token,
        }),
      );
      expect(reset.status).toBe(200);
    } finally {
      log.mockRestore();
    }
  });
});
