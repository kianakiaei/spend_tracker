import { expect, test } from "@playwright/test";

// Flow ⑤ (ticket 30) — session expiry: with the cookies gone the dashboard
// gate bounces the browser to /login, and the v1 API answers the same state
// with a 401 problem+json (the handler-level audit of every endpoint lives
// in tests/integration/api-v1-contract.test.ts).
test("expired session bounces to /login", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("دفتر هزینه", { exact: true }).first(),
  ).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/");
  await page.waitForURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: "ورود به دفتر هزینه" }),
  ).toBeVisible();
});

test("v1 without credentials is 401 problem+json", async ({
  playwright,
  baseURL,
}) => {
  // Explicitly empty: a request context born from the test's `playwright`
  // object would otherwise carry the shared project's session cookie.
  const request = await playwright.request.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const res = await request.get("/api/v1/categories");
  expect(res.status()).toBe(401);
  const body = (await res.json()) as { status?: number; title?: string };
  expect(body.status).toBe(401);
  expect(typeof body.title).toBe("string");
  await request.dispose();
});
