import { expect, test } from "@playwright/test";

// Flow ① (ticket 30) — auth: gate + toggle + generic error + sign-up. Runs
// WITHOUT the shared session (fresh jar), so it proves the logged-out
// experience from scratch.
test.use({ storageState: { cookies: [], origins: [] } });

test("logged-out / bounces to /login", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: "ورود به دفتر هزینه" }),
  ).toBeVisible();
});

test("wrong credentials speak one generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ایمیل").fill(`nope-${Date.now()}@example.com`);
  await page.getByLabel("رمز").fill("wrong-password-123");
  await page
    .locator("form")
    .getByRole("button", { name: "ورود", exact: true })
    .click();
  // Scoped to the form: Next's route announcer is also role=alert.
  await expect(
    page.locator("form").getByRole("alert"),
  ).toHaveText("ایمیل یا رمز اشتباه است");
});

test("toggle signs a fresh user up into /", async ({ page }) => {
  const email = `flow1-${Date.now()}@example.com`;
  await page.goto("/login");
  await page.getByRole("button", { name: "ثبت‌نام", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ساخت حساب در دفتر هزینه" }),
  ).toBeVisible();
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("رمز").fill("e2e-Passw0rd-123");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.waitForURL("/");
  await expect(
    page.getByText("دفتر هزینه", { exact: true }).first(),
  ).toBeVisible();
});
