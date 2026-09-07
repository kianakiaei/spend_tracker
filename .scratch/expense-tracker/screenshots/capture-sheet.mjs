// One-off visual evidence for ticket 27 (expense record/edit sheet).
// Signs up a throwaway user through the real auth mount, seeds a few rows
// through the v1 API, then screenshots: the dashboard with the FAB, the
// create sheet fresh (fallback suggestion + badge), the create sheet after
// typing (live suggestion + live fa-IR amount), the edit sheet from a
// ledger row, and its delete confirm.
//
//   node .scratch/expense-tracker/screenshots/capture-sheet.mjs
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

const email = `sara+sheet${Date.now()}@example.com`;
const password = "sheet-screens-1234";

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

async function expense(title, amount, categoryId, occurredAt) {
  const res = await request.post(`${BASE}/api/v1/expenses`, {
    data: { title, amountToman: amount, categoryId, occurredAt: occurredAt ?? null, entryMonthKey: currentKey },
  });
  if (!res.ok()) throw new Error(`expense "${title}" failed: ${res.status()} ${await res.text()}`);
}

// A small month: enough rows for a ledger, nothing else.
await expense("خرید هفتگی سوپرمارکت", 1_240_000, cat.groceries, daysAgo(jd - 1));
await expense("اسنپ تا خانه", 95_000, cat.transport, daysAgo(jd - 2));
await expense("قهوه با دوستان", 240_000, cat["cafe-restaurant"], daysAgo(jd - 3));
await expense("خرید جاافتاده", 220_000, cat.groceries, null);

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

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}sheet-0-dashboard-fab.png`, fullPage: true });
console.log("sheet-0-dashboard-fab.png");

// 1 — the create sheet, fresh: fallback suggestion (خوراکی) with its badge,
// today's date preset, empty amount.
await page.getByRole("button", { name: "ثبت خرج" }).click();
await page.getByRole("dialog").waitFor();
await page.screenshot({ path: `${OUT}sheet-1-create-fresh.png`, fullPage: true });
console.log("sheet-1-create-fresh.png");

// 2 — typed: the live suggestion moved to حمل‌ونقل (badge on) and the
// amount hint reads back in fa-IR.
await page.getByLabel("عنوان").fill("تاکسی فرودگاه");
await page.getByLabel("مبلغ").pressSequentially("123500");
await page.getByText("حمل‌ونقل", { exact: true }).first().waitFor({ timeout: 3000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}sheet-2-create-suggestion.png`, fullPage: true });
console.log("sheet-2-create-suggestion.png");
await page.getByRole("button", { name: "انصراف" }).click();

// 3 — the edit sheet from a ledger row.
await page.getByRole("button", { name: /اسنپ تا خانه/ }).click();
await page.getByRole("dialog").waitFor();
await page.screenshot({ path: `${OUT}sheet-3-edit.png`, fullPage: true });
console.log("sheet-3-edit.png");

// 4 — the inline delete confirm.
await page.getByRole("button", { name: "حذف", exact: true }).click();
await page.getByText("این خرج حذف شود؟").waitFor();
await page.screenshot({ path: `${OUT}sheet-4-delete-confirm.png`, fullPage: true });
console.log("sheet-4-delete-confirm.png");

await browser.close();
console.log("done —", email);
