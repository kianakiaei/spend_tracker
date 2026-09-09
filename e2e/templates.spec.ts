import { expect, test } from "@playwright/test";

// Flow ④ (ticket 30) — recurring template: create it in the UI, let the
// dashboard's lazy generation build this month's expense, follow the
// «خرج این ماه تولید شد» deep-link, and freely edit the generated expense
// (editing never touches the template — the sheet says so).
test("template creates this month's expense; generated row edits freely", async ({
  page,
}) => {
  const title = `قسط e2e ${Date.now()}`;
  await page.goto("/templates");
  await page.getByRole("button", { name: "افزودن الگو" }).click();
  await page.locator("#template-title").fill(title);
  await page.locator("#template-amount").fill("500000");
  await page.getByRole("button", { name: "ثبت", exact: true }).click();
  await expect(page.getByText(title)).toBeVisible();

  // The dashboard read triggers the lazy generation (decision 14).
  await page.goto("/");
  await page.goto("/templates");
  const generated = page.getByRole("link", { name: "خرج این ماه تولید شد" });
  await expect(generated.first()).toBeVisible();
  await generated.first().click();

  await expect(
    page.getByRole("heading", { name: "ویرایش خرج" }),
  ).toBeVisible();
  await expect(
    page.getByText("این خرج از الگو تولید شده"),
  ).toBeVisible();

  const edited = `${title} ویرایش`;
  await page.locator("#expense-title").fill(edited);
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ویرایش خرج" })).toHaveCount(
    0,
  );
  await expect(page.getByText(edited)).toBeVisible();
});
