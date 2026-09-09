import { db } from "@/db";
import { user } from "@/db/schema";
import { desc } from "drizzle-orm";
import { newDate } from "date-fns-jalali";
import {
  currentJalaliMonthKey,
  fromJalaliMonthKey,
  jalaliDaysInMonth,
  shiftJalaliMonthKey,
  toISODate,
} from "@/lib/jalali";
import { createCategoryService } from "@/lib/services/category-service";
import { createExpenseService } from "@/lib/services/expense-service";

const products = [
  { title: "نان", slug: "groceries", baseUnit: 30000, drift: 2000, qty: [1, 2, 3, 4], times: 8 },
  { title: "شیر", slug: "groceries", baseUnit: 45000, drift: 3000, qty: [1, 2], times: 6 },
  { title: "تخم‌مرغ", slug: "groceries", baseUnit: 120000, drift: 5000, qty: [1], times: 4 },
  { title: "مرغ", slug: "groceries", baseUnit: 180000, drift: 8000, qty: [1, 2], times: 3 },
  { title: "قهوه", slug: "cafe-restaurant", baseUnit: 95000, drift: 5000, qty: [1, 2], times: 5 },
  { title: "اسنپ", slug: "transport", baseUnit: 80000, drift: 4000, qty: [1], times: 5 },
  { title: "قبض برق", slug: "bills-internet", baseUnit: 250000, drift: 15000, qty: [1], times: 1 },
];

const expenseService = createExpenseService(db);
const categoryService = createCategoryService(db);

const [latest] = await db
  .select()
  .from(user)
  .orderBy(desc(user.createdAt))
  .limit(1);
if (!latest) throw new Error("no users — sign up first");
const userId = process.argv[2] ?? latest.id;

const cats = await categoryService.list(userId);
const bySlug = new Map(cats.map((c) => [c.slug, c]));
const current = currentJalaliMonthKey();
const monthKeys = [
  shiftJalaliMonthKey(current, -2),
  shiftJalaliMonthKey(current, -1),
  current,
];

let created = 0;
for (let mi = 0; mi < monthKeys.length; mi++) {
  const monthKey = monthKeys[mi]!;
  const daysInMonth = jalaliDaysInMonth(fromJalaliMonthKey(monthKey));
  const [y, m] = monthKey.split("-").map(Number);
  let cursor = 1;
  for (const p of products) {
    const cat = bySlug.get(p.slug);
    if (!cat) throw new Error(`missing ${p.slug}`);
    const unit = p.baseUnit + p.drift * mi;
    for (let t = 0; t < p.times; t++) {
      const day = Math.min(cursor, daysInMonth);
      cursor = (cursor % daysInMonth) + 1 + ((t + mi) % 3);
      if (cursor > daysInMonth) cursor = 1;
      const occurredAt = toISODate(newDate(y!, m! - 1, day));
      const quantity = p.qty[(t + mi) % p.qty.length]!;
      const jitter = ((t * 7919 + mi * 104729) % 3000) - 1500;
      await expenseService.create(
        userId,
        {
          amountToman: Math.max(1000, (unit + jitter) * quantity),
          quantity,
          title: p.title,
          categoryId: cat.id,
          occurredAt,
        },
        monthKey,
      );
      created++;
    }
  }
}

console.log(`seeded ${created} expenses for ${userId} in ${monthKeys.join(", ")}`);
await db.$client.close();
