// One-off visual evidence for ticket 26 (dashboard in three month states).
// Signs up a throwaway user through the real auth mount, seeds prototype-
// like data through the v1 API (current month rows + one undated row +
// active recurring templates for the lazy generator + past-month rows),
// then screenshots /, the past month, and the future month.
//
//   node .scratch/expense-tracker/screenshots/capture.mjs
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
const key = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const shiftKey = (k, n) => {
  const [y, m] = k.split("-").map(Number);
  const t = m - 1 + n;
  return key(y + Math.floor(t / 12), ((t % 12) + 12) % 12 + 1);
};
const currentKey = key(jy, jm);
const pastKey = shiftKey(currentKey, -1);
const futureKey = shiftKey(currentKey, 1);
const daysAgo = (n) => iso(new Date(new Date(today).getTime() - n * 86400000));

const email = `sara+dash${Date.now()}@example.com`;
const password = "dash-screens-1234";

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

const categories = (await (await request.get(`${BASE}/api/v1/categories`)).json());
const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));
const custom = await (
  await request.post(`${BASE}/api/v1/categories`, {
    data: { name: "پوشاک", color: "#8f8040" },
  })
).json();
const cat = { ...bySlug, clothes: custom.id };

async function expense(title, amount, categoryId, occurredAt, entryMonthKey = currentKey) {
  const res = await request.post(`${BASE}/api/v1/expenses`, {
    data: { title, amountToman: amount, categoryId, occurredAt: occurredAt ?? null, entryMonthKey },
  });
  if (!res.ok()) throw new Error(`expense "${title}" failed: ${res.status()} ${await res.text()}`);
}

// Active templates: the current month's first dashboard read lazily
// generates the ones due (loan installments + internet, decision 14); all
// four forecast into the future month.
async function template(title, amount, categoryId, dayOfMonth) {
  const res = await request.post(`${BASE}/api/v1/recurring-templates`, {
    data: { title, amountToman: amount, categoryId, dayOfMonth, startDate: daysAgo(jd - 1) },
  });
  if (!res.ok()) throw new Error(`template "${title}" failed: ${res.status()} ${await res.text()}`);
}

await template("قسط وام مسکن", 2_850_000, cat.installment, 5);
await template("قسط وام خودرو", 1_420_000, cat.installment, 5);
await template("اینترنت خانه", 450_000, cat["bills-internet"], 12);
await template("باشگاه بدنسازی", 900_000, cat["health-beauty"], 20);

// Current month (days up to today) + one undated row for the chip.
const rows = [
  ["خرید هفتگی سوپرمارکت", 1_240_000, cat.groceries, 1],
  ["اسنپ تا خانه", 95_000, cat.transport, 1],
  ["نان بربری", 60_000, cat.groceries, 2],
  ["قهوه با دوستان", 240_000, cat["cafe-restaurant"], 3],
  ["میوه و سبزیجات", 480_000, cat.groceries, 4],
  ["بنزین", 450_000, cat.transport, 5],
  ["نان و شیر", 125_000, cat.groceries, 7],
  ["آرایشگاه", 350_000, cat["health-beauty"], 8],
  ["اسنپ", 80_000, cat.transport, 8],
  ["قبض برق", 312_000, cat["bills-internet"], 9],
  ["سوپرمارکت محله", 310_000, cat.groceries, 9],
  ["کافه لاته", 180_000, cat["cafe-restaurant"], 10],
  ["تاکسی", 60_000, cat.transport, 11],
  ["نان سنگک", 75_000, cat.groceries, 12],
  ["داروخانه", 218_000, cat["health-beauty"], 12],
  ["پیتزا سفارش آنلاین", 640_000, cat["cafe-restaurant"], 13],
  ["کفش", 1_450_000, cat.clothes, 13],
  ["خواروبار هفتگی", 980_000, cat.groceries, 14],
  ["مترو کارت", 150_000, cat.transport, 15],
];
for (const [title, amount, categoryId, day] of rows) {
  if (day <= jd) await expense(title, amount, categoryId, daysAgo(jd - day));
}
await expense("خرید جاافتاده", 220_000, cat.groceries, null);

// Past month (offsets from the month's last day — always inside it).
const pastDay = (back) => daysAgo(jd + back);
await expense("نان و شیر", 150_000, cat.groceries, pastDay(2), pastKey);
await expense("بنزین", 430_000, cat.transport, pastDay(6), pastKey);
await expense("قبض برق", 290_000, cat["bills-internet"], pastDay(9), pastKey);
await expense("قهوه با دوستان", 210_000, cat["cafe-restaurant"], pastDay(13), pastKey);

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

async function shot(search, file) {
  await page.goto(`${BASE}/${search}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}${file}`, fullPage: true });
  console.log(`${file}  (${page.url()})`);
}

await shot("", "dashboard-current.png");
await shot(`?month=${pastKey}`, `dashboard-past-${pastKey}.png`);
await shot(`?month=${futureKey}`, `dashboard-future-${futureKey}.png`);

await browser.close();
console.log("done —", email);
