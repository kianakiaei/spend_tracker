# 24 — سرویس جمع (summaries) + ترکیب پیش‌بینی ماه آینده

Type: task
Status: resolved
Blocked by: 22, 23
Assignee: IDEHAL (agent session, 2026-09-06)

## Question

`summaryService` در `src/lib/services` — شکل قرارداد تیکت ۱۲ **+ ترکیب additive تیکت ۱۵**؛ سرویس واحد مشترک RSC و handler:

- `getSummary(userId, monthKey)` → `{ monthKey, totalToman, byCategory: [{ categoryId, name, totalToman, count }], forecastToman? }`.
- **ماه جاری:** قبل از خواندن `ensureRecurringExpensesGenerated` (تیکت ۲۳) — پیش‌بینی ندارد (همهٔ واجدها اول ماه تولید شده‌اند)؛ `forecastToman` نمی‌آید.
- **ماه گذشته:** فقط ثبت‌شده‌ها؛ هرگز ensure، هرگز پیش‌بینی (ماه جاافتاده خالی می‌ماند).
- **ماه آینده:** جمع ترکیبی = ثبت‌شده + جمع الگوهای فعالِ واجد شرط (منطق خالص ۲۳)؛ `byCategory` ترکیبی (سطر پیش‌بینی با دستهٔ الگوی خودش)؛ **فیلد additive `forecastToman`** (جمع فقط-الگوها؛ همیشه حاضر برای آینده، می‌تواند صفر)؛ زیرنویس «شامل پیش‌بینی» تصمیم UI است نه این سرویس.
- **سیم‌کشی دوم ensure (تصمیم ۱۴):** `expenseService.listByMonth` — فقط وقتی ماه درخواستی ماه جاری است، قبل از خواندن ensure. ثبت خرجِ تازه call-site نیست.
- عملکرد: جمع در SQL (GROUP BY monthKey/categoryId) نه در حافظه؛ خواندن دسته‌ها یک‌جا برای نام/ترتیب کاشی‌ها.

## Test plan

- integration — آستانهٔ `services` ≥۸۰/۷۵ ادامه می‌یابد.
- ماه آینده: total = ثبت‌شده + پیش‌بینی، forecastToman دقیق، byCategory ترکیبی؛ ماه جاری پس از ensure شامل خرج‌های تولیدشده؛ ماه گذشته بدون ensure و بدون فیلد forecast؛ سیم‌کشی listByMonth فقط در ماه جاری تولید trigger می‌کند (با spy/شمارش INSERT).

## Comments

- 2026-09-06 — **رزول شد: `summaryService.getSummary` سبز — شکل قرارداد ۱۲ + ترکیب additive تیکت ۱۵ + سیم‌کشی دوم ensure؛ صفر import از `next/*`** — lint/tsc/vitest **۲۰۵ پاس** (۱۶ فایل)؛ پوشش services **۹۶٫۷٪ خط / ۸۸٫۶٪ شاخه** در برابر آستانهٔ ۸۰/۸۰ (خط تیکت «≥۸۰/۷۵» بود؛ آستانهٔ فعال‌شدهٔ ۱۹ همان ۸۰/۸۰ است و دست نخورد). ساختار: `src/lib/services/summary-service.ts` + سیم‌کشی در `expense-service.ts`. تصمیم‌های تفسیری ثبت‌شده:
  - **جمع در SQL = GROUP BY categoryId با monthKey به‌عنوان WHERE مساوی** — هم‌ارز «GROUP BY monthKey/categoryId» تیکت است (کلید ماه در کوئری ثابت است)؛ سطرهای خرجِ ماه هرگز به حافظه نمی‌آیند؛ دسته‌ها در یک خواندن برای نام/ترتیب کاشی‌ها (ترتیب = همان `categoryService.list`: order سپس createdAt)؛ دستهٔ بی‌پولِ این ماه از کاشی‌ها حذف می‌شود.
  - **`count` = تعداد خرج‌های ثبت‌شده فقط** — سطر پیش‌بینی خرج نیست (لیست آن در preview تیکت ۲۳ است) و به count اضافه نمی‌شود؛ به totalToman اضافه می‌شود. کاشیِ فقط-پیش‌بینی count=0 دارد.
  - **`forecastToman` برای جاری/گذشته کلیدِ غایب است** (نه undefined) — JSON تمیز برای handler تیکت ۲۵؛ برای آینده همیشه حاضر، حتی صفر. زیرنویس «شامل پیش‌بینی» تصمیم UI است.
  - **ترکیب ماه آینده از همان منطق خالص ۲۳ استفاده می‌کند** — کمک‌تابع مشترک `listActiveDueTemplates` (SELECT الگوهای فعال + predیکیت `isTemplateDueInMonth`) حالا بین ensure و preview و summary یک‌جاست؛ هر سطر پیش‌بینی با دستهٔ الگوی خودش در کاشی‌ها ادغام می‌شود.
  - **سیم‌کشی دوم ensure (تصمیم ۱۴):** `expenseService.listByMonth` فقط وقتی ماه درخواستی == ماه جلالی جاری قبل از خواندن ensure را صدا می‌زند — با شمارش INSERT (پروکسی جاسوسی) ثابت شد: گذشته/آینده صفر insert، جاری دقیقاً یک؛ ثبتِ خرجِ تازه call-site نیست (تست). گِیت صریح در call-site عمدی است (مستندسازی سیم‌بندی تصمیم ۱۴)؛ ensure خودش هم گِیت داخلی دارد.
  - **additive سخت‌گیرانه — حذف دسته‌ای که الگوی تکرار به آن اشاره می‌کند 409 می‌دهد** (`CategoryInUseError`): ترکیب تیکت ۲۴ فقط وقتی تعریف‌شده است که دستهٔ هر سطر پیش‌بینی زنده باشد؛ بدون این گارد، حذف دسته سطرهای پیش‌بینی بی‌دسته می‌ساخت. همان 409 قرارداد ۱۲ («حذف دستهٔ دارای خرج») با پیام جدای الگو. دادهٔ پیشاموندهٔ نقض‌کننده وجود ندارد (اپ هنوز دیپلوی نشده — تیکت ۳۱) و مسیرِ جدید از لحظهٔ ساخت بسته است؛ `listByMonth` هم با innerJoin همین ناوردای «دستهٔ زنده» را دارد.
  - **از code-review (دو محور) اعمال شد:** استخراج `listActiveDueTemplates` مشترک (سومین نسخهٔ همان کوئری)، کمک‌تابع‌های مشترک تست (`tests/helpers/fixtures.ts`: کلیدهای ماه نسبی، `systemCategoryBySlug`، `generatedExpenses`)، دقت کامنت جاسوسی INSERT. نتیجهٔ محور Spec: همهٔ بندهای تیکت و طرح تست پوشش داده شد، بدون نقص.
  - گام بعدی: تیکت ۲۵ (API v1 + problem+json + fetch wrapper) آزاد شد؛ ۱۶ (HITL) مستقل.
