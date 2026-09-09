import { expect, test as setup } from "@playwright/test";

// Ticket 30: the ONE sign-up per e2e run. The shared user is created through
// the real UI (toggle + form), then its cookies are frozen to
// e2e/.auth/user.json — every flow spec reuses that storageState instead of
// signing in again.
setup("sign up the shared e2e user", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/login");
  await page.getByRole("button", { name: "ثبت‌نام", exact: true }).click();
  await page.getByLabel("ایمیل").fill(email);
  await page.getByLabel("رمز").fill("e2e-Passw0rd-123");
  await page.getByRole("button", { name: "ساخت حساب", exact: true }).click();
  await page.waitForURL("/");
  await expect(
    page.getByText("دفتر هزینه", { exact: true }).first(),
  ).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
