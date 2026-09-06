# 24 — سرویس جمع (summaries) + ترکیب پیش‌بینی ماه آینده

Type: task
Status: open
Blocked by: 22, 23

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
