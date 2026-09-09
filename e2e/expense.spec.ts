import { expect, test } from "@playwright/test";

// Flow ② (ticket 30) — record an expense: the live «پیشنهاد» badge on a
// lexicon phrase, the manual override via «تغییر» (badge drops, engine goes
// silent), and the fa-IR amount preview — then the row is in the ledger.
test("add expense: live suggestion, manual override, fa-IR amount", async ({
  page,
}) => {
  const title = `اسنپ فود e2e ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "ثبت خرج" }).click();
  await expect(
    page.getByRole("heading", { name: "ثبت خرج" }),
  ).toBeVisible();

  await page.locator("#expense-title").fill(title);
  await expect(
    page.getByText("پیشنهاد", { exact: true }),
  ).toBeVisible();

  await page.locator("#expense-amount").fill("250000");
  await expect(page.getByText(/۲۵۰٬۰۰۰/)).toBeVisible();

  await page.getByRole("button", { name: "تغییر" }).click();
  await page.getByRole("button", { name: "حمل‌ونقل" }).click();
  await expect(page.getByText("پیشنهاد", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "ثبت", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ثبت خرج" })).toHaveCount(0);
  await expect(page.getByText(title)).toBeVisible();
});
