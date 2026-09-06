# 20 — ماژول واحد تاریخ جلالی src/lib/jalali

Type: task
Status: in progress
Blocked by: 18
Assignee: IDEHAL (agent session, 2026-09-06)

## Question

کل منطق تقویم پشت ماژول واحد و خالص `src/lib/jalali` (قاعدهٔ تیکت ۱۲: import از `next/*` ممنوع) با الگوی تثبیت‌شدهٔ تحقیق ۰۴ — «ذخیرهٔ میلادی، نمایش جلالی»:

- وابستگی: `date-fns-jalali ^4.4.0-0` (fork کامل date-fns v4) — و `react-multi-date-picker ^4.5.2` فقط نصب و تأیید سازگاری React 19 (مصرف واقعی در فرم: تیکت ۲۷).
- توابع پیشنهادی تحقیق ۰۴ (~۱۴ تابع) حداقل: `jalaliMonthKey` (از تاریخ میلادی → `'1405-06'`)، `startOfJalaliMonth`/`endOfJalaliMonth`، `daysInJalaliMonth`، `addJalaliMonths` (با clamp ۳۰ اسفند)، `jalaliMonthLabel` (نام ماه + سال فارسی)، `currentJalaliMonthKey` — «اکنون» باید **تهران‌آگاه** باشد (Asia/Tehran) چون سرور Vercel روی UTC است (الزام تیکت ۱۴: مرز نیمه‌شب تهران، نه UTC)، و توابع کمکی فرمت/parse رشتهٔ date-only.
- قواعد سفت: تاریخ همیشه رشتهٔ `'YYYY-MM-DD'` میلادی؛ ساخت Date فقط با `parseISO` (نیمه‌شب محلی)؛ **هرگز `new Date('YYYY-MM-DD')`**؛ تبدیل جلالی فقط در نمایش؛ ارقام/مبلغ با `Intl.NumberFormat('fa-IR')` و `fa-IR-u-ca-persian` فقط برای رشته‌های نمایشی (توابع `formatToman` و نمایش تاریخ جلالی همین‌جا).
- گودال‌های شناخته‌شدهٔ تحقیق ۰۴ باید پوشته شوند: کبیسهٔ اسفند (۱۴۰۳ کبیسه)، clamp در add، تفکیک تقویم `persian` از `jalali` در react-date-object.

## Test plan

- unit در project node — آستانهٔ این glob از این تیکت فعال شود: `src/lib/jalali` ≥۹۰٪ خط / ≥۸۵٪ شاخه.
- چک‌لیست تحقیق ۰۴: monthKey درست برای نمونه‌های مرزی سال، clamp از ۳۰ اسفند در سال غیرکبیسه، کبیسهٔ ۱۴۰۳، رندتریپ روی بازهٔ وسیع (۱۹۹۶–۲۰۶۰)، **مرز ساعت تهران/UTC** (مثلاً ۲۰:۳۰ UTC = روز بعد در تهران → ماه جاری درست)، فرمت fa-IR ارقام.
