import { expect, test } from "@playwright/test";

// Ticket 18 smoke: the Next server boots, serves the app, and the better-auth
// mount is reachable. The five real E2E flows arrive with ticket 30.
test("app root responds with the scaffold page", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Create Next App/);
});

test("better-auth route is mounted", async ({ request }) => {
  const res = await request.get("/api/auth/ok");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
