// One-off visual evidence for ticket 28 (drilldown + categories + templates).
// Signs up a throwaway user through the real auth mount, seeds a custom
// category, a recurring template and a few expenses through the v1 API,
// then screenshots: the categories page, the templates page, the drilldown
// of a category and the locked-create sheet on top of it.
//
//   node .scratch/expense-tracker/screenshots/capture-ticket28.mjs
//
// Assumes `pnpm dev` on :3000 and TURSO_DATABASE_URL=file:./local.db.

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const TEHRAN = { timeZone: "Asia/Tehran" };
const iso = (d) =>
  new Intl.DateTimeFormat("en-CA", { ...TEHRAN, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const jalali = (d) => {
  const parts = new Intl.DateTimeFormat("en-u-ca-persian", { ...TEHRAN, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d);
  const pick = (type) => Number(parts.find((p) => p.type === type).value);
  return [pick("year"), pick("month"), pick("day")]; // [y, m, d]
};

const today = iso(new Date());
const [jy, jm, jd] = jalali(new Date(today));
const currentKey = `${jy}-${String(jm).padStart(2, "0")}`;
const daysAgo = (n) => iso(new Date(new Date(today).getTime() - n * 86400000));

const email = `sara+ticket28-${Date.now()}@example.com`;
const password = "ticket28-screens-1234";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 420, height: 950 },
  deviceScaleFactor: 2,
});
const request = context.request;

const signup = await request.post(`${BASE}/api/auth/sign-up/email`, {
  data: { name: "سارا نمونه", email, password },
});
if (!signup.ok()) throw new Error(`sign-up failed: ${signup.status()} ${await signup.text()}`);

const categories = await (await request.get(`${BASE}/api/v1/categories`)).json();
const cat = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

async function createCategory(name, color) {
  const res = await request.post(`${BASE}/api/v1/categories`, { data: { name, color } });
  if (!res.ok()) throw new Error(`category "${name}" failed: ${res.status()} ${await res.text()}`);
  return (await res.json()).id;
}
async function expense(title, amount, categoryId, occurredAt) {
  const res = await request.post(`${BASE}/api/v1/expenses`, {
    data: { title, amountToman: amount, categoryId, occurredAt: occurredAt ?? null, entryMonthKey: currentKey },
  });
  if (!res.ok()) throw new Error(`expense "${title}" failed: ${res.status()} ${await res.text()}`);
}
async function template(title, amount, categoryId, dayOfMonth) {
  const res = await request.post(`${BASE}/api/v1/recurring-templates`, {
    data: { title, amountToman: amount, categoryId, dayOfMonth, startDate: today, endDate: null },
  });
  if (!res.ok()) throw new Error(`template "${title}" failed: ${res.status()} ${await res.text()}`);
  return (await res.json()).id;
}

// A believable month: groceries + transport rows, one paused installment
// template whose expense got generated this month, and one future-month
// template for the preview block.
await createCategory("کتاب و لوازم التحریر", "#7a5fc4");
await createCategory("ورزش", "#3da3c4");
await expense("خرید هفتگی سوپرمارکت", 1_240_000, cat.groceries, daysAgo(jd - 1));
await expense("اسنپ تا خانه", 95_000, cat.transport, daysAgo(jd - 2));
await expense("قهوه با دوستان", 240_000, cat["cafe-restaurant"], daysAgo(jd - 3));
await expense("خرید جاافتاده", 220_000, cat.groceries, null);
await expense("قسط وام مسکن", 4_500_000, cat.installment, daysAgo(jd - 4));
await template("قسط وام مسکن", 4_500_000, cat.installment, 5);
await template("شارژ اینترنت خانه", 320_000, cat["bills-internet"], 28);

mkdirSync(OUT, { recursive: true });
const page = await context.newPage();
// The Next dev-tools badge is dev chrome, not the app — keep it out of the
// ticket's visual evidence.
await page.addInitScript({
  content: `document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal{display:none!important}';
    document.head.appendChild(style);
  });`,
});

// 1 — the categories page: counters, the guard, the add form open.
await page.goto(`${BASE}/categories`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}t28-0-categories.png`, fullPage: true });
console.log("t28-0-categories.png");
await page.getByRole("button", { name: "افزودن دسته" }).click();
await page.getByLabel("نام دسته").fill("ورزش");
await page.getByRole("radio", { name: "آبی" }).click();
await page.screenshot({ path: `${OUT}t28-1-categories-add.png`, fullPage: true });
console.log("t28-1-categories-add.png");
await page.getByRole("button", { name: "انصراف" }).click();

// 2 — the templates page: rows, the generated-this-month link, the preview.
await page.goto(`${BASE}/templates`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}t28-2-templates.png`, fullPage: true });
console.log("t28-2-templates.png");

// 3 — the drilldown of خوراکی (this month).
await page.goto(`${BASE}/categories/${cat.groceries}?month=${currentKey}`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}t28-3-drilldown.png`, fullPage: true });
console.log("t28-3-drilldown.png");

// 4 — the locked-create sheet from the drilldown CTA.
await page.getByRole("button", { name: "افزودن به این دسته" }).click();
await page.getByRole("dialog").waitFor();
await page.getByLabel("عنوان").fill("نان بربری");
await page.getByLabel("مبلغ").pressSequentially("85000");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}t28-4-drilldown-locked-sheet.png`, fullPage: true });
console.log("t28-4-drilldown-locked-sheet.png");

await browser.close();
console.log("done —", email);
