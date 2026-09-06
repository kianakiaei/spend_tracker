# 23 — سرویس الگوی تکرار + تولید lazy (ensure) + پیش‌نمایش

Type: task
Status: resolved
Blocked by: 19, 20
Assignee: IDEHAL (agent session, 2026-09-06)

## Question

منطق خالص در `src/lib/recurring` (گلوب آستانهٔ ۹۰/۸۵ تیکت ۱۱) + سرویس آن در `src/lib/services` — تصمیم‌های ۱۴ و ۱۵:

- منطق خالص مشترک بین ensure و preview (تصریح تیکت ۱۵): **predیکیت واجد شرط** (`active` و `startDate` ≤ پایان ماه و (endDate تهی یا ≥ آغاز ماه))، **clamp روز به آخر ماه** (روزِ الگو در آن ماه نبود → آخرین روز همان ماه)، شکل سطر پیش‌بینی.
- `recurringService`: CRUD الگو؛ ساخت/ویرایش الگو **یادگیری می‌سازد** (مثل خرج — موتور ۲۱) ولی **تولید خودکار هرگز یادگیری نمی‌سازد** (تصمیم ۰۶)؛ توقف/ازسرگیری = toggle `active`.
- `ensureRecurringExpensesGenerated(userId, monthKey)` (تصمیم ۱۴ — lazy-on-request): گِیت «فقط وقتی monthKey == ماه جلالی جاری (تهران‌آگاه از ماژول ۲۰)»؛ SELECT الگوهای فعالِ واجد شرطِ بی‌خرج برای این ماه → INSERT خرج با `ON CONFLICT DO NOTHING` روی یونیک‌ایندکس `(userId, sourceRecurringId, monthKey)` (مسابقهٔ درخواست هم‌زمان بی‌خطر)؛ **الگوی میان‌ماهی با روزِ گذشته هم همین ماه تولید می‌شود** (خرج پس‌تاریخ، آزادانه‌حذف) — تنها گِیت startDate است؛ خرجِ تولیدشده fieldهای استاندارد خرج را دارد + sourceRecurringId.
- **رفتار خطا: خواندن هرگز به‌خاطر تولید نمی‌شکند** — ensure در try/catch؛ خطا لاگ و پاسخ با دادهٔ موجود ادامه می‌یابد؛ تلاش مجدد در درخواست بعد رایگان است (idempotency).
- ماه جاافتاده: هرگز backfill نمی‌شود (ماه گذشته هرگز ensure نمی‌گیرد — تصمیم ۱۴/۰۵).
- `preview(userId, monthKey)`: فقط برای ماه‌های **بعد از** جاری؛ خروجی `[{ templateId, title, amountToman, categoryId, day }]` — همان predیکیت و clamp (تصمیم ۱۵).

## Test plan

- unit خالص (node): predیکیت برای الگوهای شروع/پایان‌دار، clamp روز ۳۰/۳۱ در ماه‌های ۲۹–۳۰روزه، تفکیک ماه جاری/گذشته/آینده در گِیت‌ها — آستانهٔ `src/lib/recurring` ≥۹۰/۸۵.
- integration: دو بار ensure پشت‌سرهم → خرج تکراری صفر؛ دو فراخوانی موازی → فقط یک سطر؛ میان‌ماهی (ساخت الگو روز ۲۰ با روزِ ۱۰) → خرج همین ماه با تاریخ پس‌تاریخ؛ ناوبری به ماه گذشته/آینده → صفر تولید؛ خطای تزریقی در تولید → خواندن با دادهٔ موجود جواب می‌دهد؛ ساخت الگو یادگیری می‌سازد، تولید نه.

## Comments

- 2026-09-06 — **رزول شد: منطق خالص `src/lib/recurring` + `recurringService` + `ensureRecurringExpensesGenerated` + `preview` سبز — صفر import از `next/*`** — lint/tsc/vitest **۱۹۶ پاس** (۱۵ فایل)؛ پوشش recurring **۱۰۰٪ خط / ۱۰۰٪ شاخه** (آستانهٔ ۹۰/۸۵ همین تیکت در vitest.config فعال شد)، services ۹۶٫۲٪/۸۷٫۷٪ در برابر ۸۰/۸۰. ساختار: `src/lib/recurring/index.ts` (هستهٔ مشترک ensure و preview: `jalaliMonthBounds`، `isTemplateDueInMonth` — عین predیکیت تصمیم ۱۴، `clampedDayOfMonth`/`occurrenceISO`، `monthPosition`، `toForecastRow` — عین شکل قرارداد ۱۲)؛ `src/lib/services/recurring-service.ts` (CRUD + یادگیری روی ساخت/ویرایش با `learnOnSave` دستهٔ نهایی)؛ additive به ماژول ۲۰: `fromJalaliMonthKey` (وارونِ `jalaliMonthKey`، با گارد اسکیما) — «تقویم فقط در ماژول جلالی» حفظ شد. تصمیم‌های تفسیری ثبت‌شده:
  - **سپر خطای ensure = فقط شکستِ تولید؛ اعتبارسنجی ورودی عمداً بیرون try/catch است.** «خواندن هرگز به‌خاطر تولید نمی‌شکند» (تصمیم ۱۴ §۴) دربارهٔ شکستِ تولید است — monthKey خراب یک باگ فراخوان است و بلعیدنش آن را از چشم handler تیکت ۲۵ (problem+json 400) مخفی می‌کرد. تست خطای تزریقی هر دو فاز select و insert را می‌پوشاند + بهبود خودبه‌خودی در درخواست بعد (idempotency).
  - **اعتبارسنجی پنجرهٔ الگو (additive):** تاریخ‌های واقعی تقویم (نه فقط فرمت) و `endDate ≥ startDate` — روی **جفت نهایی** در ویرایش (موجود + جدید ادغام‌شده)؛ نقض = 400.
  - **تولید هرگز یادگیری نمی‌سازد** (تصمیم ۰۶) — تست با snapshot ردیف‌های learnedKeys پیش/پس از ensure اثبات شد؛ ساخت/ویرایش الگو همان مسیر `learnOnSave` خرج را می‌رود.
  - **حذف الگو آزاد** — خرج‌های تولیدشده مستقل می‌مانند (sourceRecurringId فقط اثباتِ منشأ است، نه FK)؛ تست: حذف الگو → خرج در ledger سر جایش.
  - **preview:** فقط ماه‌های بعد از جاری (جاری/گذشته = `[]`)، فیلتر predیکیت مشترک، clamp همان تولیدی، مرتب‌سازی صعودی روز (sort پایدار = tie-break ترتیب ساخت)؛ خروجی دقیقاً `[{ templateId, title, amountToman, categoryId, day }]`.
  - **گیت‌ها نسبت به «اکنونِ واقعی» تهران‌آگاه‌اند** — تست‌ها کلید ماه نسبی (قبلی/جاری/بعدی را از `currentJalaliMonthKey` می‌سازند) تا با گذر زمان شکننده نشوند.
  - **سیم‌کشی ensure به دو سرویس خواندن (summaries و listByMonth) طبق تصمیم ۱۴/تیکت ۲۴ در همین تیکت نیست** — اینجا فقط خودِ سرویس با گِیت داخلی.
  - **از code-review (دو محور) اعمال شد:** `occurrenceISO` حالا با `fromISODate` ماژول جلالی می‌سازد نه `new Date` دستی (تک‌ماژول‌بودن دانش تقویم)؛ تست خطای تزریقی فاز select را هم پوشش داد. باقی‌مانده به‌عنوان «دفعهٔ بعد»: استخراج if-cascade مشترکِ update بین expense/recurring service؛ چک اضافی `active` در preview بعد از فیلتر SQL (بی‌ضرر).
  - گام بعدی: تیکت ۲۴ (summaryService + ترکیب پیش‌بینی) آزاد شد؛ ۱۶ (HITL) مستقل.
