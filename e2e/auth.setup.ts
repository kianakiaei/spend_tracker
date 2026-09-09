import { createHmac } from "node:crypto";
import { expect, test as setup } from "@playwright/test";

// Ticket 30: the ONE sign-up per e2e run. The shared user is created through
// the real UI (toggle + form) — which now stops at the "check your email"
// notice instead of logging in — then verified through the REAL
// /api/auth/verify-email endpoint. Only the email TRANSPORT is stubbed: the
// token is minted here with the same HS256 shape better-auth uses
// ({ email, iat, exp }, raw BETTER_AUTH_SECRET). Cookies are frozen to
// e2e/.auth/user.json — every flow spec reuses that storageState instead of
// signing in again.

// Must match webServer.env.BETTER_AUTH_SECRET in playwright.config.ts.
const E2E_SECRET = "e2e-only-dev-secret-not-a-real-credential";

function mintVerifyToken(email: string): string {
  const b64url = (b: Buffer) => b.toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(Buffer.from(JSON.stringify({ alg: "HS256" })));
  const payload = b64url(
    Buffer.from(
      JSON.stringify({ email: email.toLowerCase(), iat: now, exp: now + 3600 }),
    ),
  );
  const signature = b64url(
    createHmac("sha256", E2E_SECRET).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

setup("sign up the shared e2e user", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/login");
  await page.getByRole("button", { name: "ثبت‌نام", exact: true }).click();
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("رمز").fill("e2e-Passw0rd-123");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await expect(
    page.getByText("پیوند تأیید را به ایمیلت فرستادیم", { exact: false }),
  ).toBeVisible();

  await page.goto(
    `/api/auth/verify-email?token=${mintVerifyToken(email)}&callbackURL=${encodeURIComponent("/")}`,
  );
  await page.waitForURL("/");
  await expect(
    page.getByText("دفتر هزینه", { exact: true }).first(),
  ).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
