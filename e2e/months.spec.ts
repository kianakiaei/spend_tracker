import { expect, test } from "@playwright/test";

// Flow ③ (ticket 30) — month navigation: a far-past month is recorded-only
// and empty («خرجی ثبت نشده»), while the month AFTER the current one carries
// the recurring forecast (the «شامل پیش‌بینی» note + «پیش‌بینی» badge).
// The forecast needs a live template, created here through the v1 API.
test("month nav: past recorded-only, future with forecast badge", async ({
  page,
}) => {
  await page.goto("/?month=1400-01");
  await expect(page.getByText(/خرجی ثبت نشده/)).toBeVisible();
  await expect(page.getByText("شامل پیش‌بینی")).toHaveCount(0);

  const categoriesRes = await page.request.get("/api/v1/categories");
  expect(categoriesRes.status()).toBe(200);
  const categories = (await categoriesRes.json()) as Array<{ id: string }>;
  const today = new Date().toISOString().slice(0, 10);
  const templateRes = await page.request.post("/api/v1/recurring-templates", {
    data: {
      amountToman: 400000,
      title: `پیش‌بینی e2e ${Date.now()}`,
      categoryId: categories[0]!.id,
      dayOfMonth: 1,
      startDate: today,
    },
  });
  expect(templateRes.status()).toBe(201);

  await page.goto("/");
  await page.getByRole("button", { name: "ماه بعد" }).click();
  await expect(page.getByText("شامل پیش‌بینی")).toBeVisible();
  await expect(
    page.getByText("پیش‌بینی", { exact: true }).first(),
  ).toBeVisible();
});
