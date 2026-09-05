# 04 — ابزار تاریخ جلالی

Type: research
Status: resolved
Blocked by: —

## Question

کار با تقویم جلالی در این اپ دقیقاً با چه ابزار و الگویی؟

- date-fns-jalali: مرز ماه جلالی، startOfMonth/endOfMonth و گروه‌بندی ماهانهٔ خرج‌ها؛ تبدیل و فرمت.
- react-multi-date-picker در فرم RTL: مقدار میلادی در state، نمایش جلالی در UI؛ نسخهٔ سازگار با React 19.
- تثبیت اصل «ذخیره‌سازی میلادی، نمایش جلالی» + نمایش ارقام فارسی با `Intl.NumberFormat('fa-IR')`.
- هر گودال شناخته‌شده (مثل اختلاف ۶۳ سالهٔ کبیسه، tz، فرمت ورودی/خروجی).
- مقصد یافته‌ها: `.scratch/expense-tracker/research/jalali-dates.md`

## Answer

الگوی «ذخیره میلادی، نمایش جلالی» با سه ابزار تثبیت شد: منطق تقویم و گروه‌بندی ماهانه با `date-fns-jalali@^4.4.0-0` (fork کامل date-fns v4؛ همهٔ helper ها مثل `startOfMonth`/`getDaysInMonth`/`format`/`parse` روی ماه جلالی عمل می‌کنند و کلید ماه از `format(d,'yyyy-MM')` → `'1405-06'` می‌آید)، انتخاب تاریخ در فرم با `react-multi-date-picker@^4.5.2` (با `calendar={persian}` + `locale={persian_fa}` و `onChange={d => setValue(d.toDate())}` تا state میلادی بماند؛ peer dep آن `react >= 16.8.0` است و با React 19 بدون تنظیم اضافه نصب می‌شود)، و ارقام فارسی/مبالغ با `Intl.NumberFormat('fa-IR')` (+ `fa-IR-u-ca-persian` فقط برای رشته‌های نمایشی آماده — روی ۲۴ هزار روز 1996–2060 با date-fns-jalali صفر اختلاف). تاریخ بدون ساعت همیشه رشتهٔ `YYYY-MM-DD` میلادی ذخیره و با `parseISO` (نیمه‌شب محلی) ساخته می‌شود، هرگز `new Date('...')`؛ گودال‌های کبیسهٔ اسفند (۱۴۰۳ کبیسه)، clamp در `addMonths`/`addYears` از ۳۰ اسفند و تفکیک تقویم `persian` از `jalali` در react-date-object در سند پوشش داده و چک‌لیست تست دارد. پیاده‌سازی باید پشت ماژول کوچک `jalali-date.ts` با ۱۴ تابع پیشنهادی (`jalaliMonthKey`، `startOfJalaliMonth`، `jalaliMonthLabel`، `formatToman`، …) برود. جزئیات و کدها: [یافته‌های پژوهش](../research/jalali-dates.md)
