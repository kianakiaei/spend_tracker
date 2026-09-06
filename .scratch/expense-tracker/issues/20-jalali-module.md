# 20 — ماژول واحد تاریخ جلالی src/lib/jalali

Type: task
Status: resolved
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

## Answer

**تمام شد (2026-09-06) — سبز کامل: lint ✓ / tsc ✓ / vitest 68/68 ✓ (با آستانهٔ تازهٔ ۲۰) / e2e 2/2 ✓ / build ✓.** کامیت‌ها: `6bc7233` (claim) → `e244698` (deps) → سه اسلایس TDD (`feat(lib)` ×۳: هستهٔ date-only، ماشین ماه جلالی، نمایش) → `test:` اسموک پیکر + آستانه‌های پوشش → `chore(lint)` نادیده‌گرفتن پوشه‌های تولیدی.

**ماژول (`src/lib/jalali/index.ts`):** تک‌فایل خالص، بدون import از `next/*`، تنها نقطهٔ import از `date-fns-jalali` در اپ — ۱۵ تابع:

- **پایهٔ date-only (قاعدهٔ سفت تیکت ۰۴):** `toISODate` (از اجزای محلی، چهارتقمی) و `fromISODate` (فقط `parseISO` → نیمه‌شب محلی؛ هرگز `new Date('YYYY-MM-DD')`). `fromISODate` گارد دوطبقه دارد: فرمت با `dateOnlySchema` (بازاستفاده از Zod تیکت ۱۹) و تاریخ ناموجود تقویمی (`2026-02-30` → `parseISO` تاریخ نامعتبر) → هر دو `RangeError`.
- **ماشین ماه جلالی:** `jalaliMonthKey` (`'1405-06'` صفردار و لغگانی‌مرتب)، `startOfJalaliMonth`/`endOfJalaliMonth`، `jalaliDaysInMonth`، `addJalaliMonths` (clamp بومی ۳۰ اسفند)، `currentJalaliMonthKey(now?)` — **تهران‌آگاه**: روز تقویمی تهران با `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tehran'})` استخراج و از همان مسیر fromISODate/jalaliMonthKey می‌گذرد (مستقل از tz سرور؛ الزام تیکت ۱۴).
- **نمایش:** `formatJalali` (پیش‌فرض `yyyy/MM/dd` **با ارقام فارسی**)، `jalaliMonthLabel` («شهریور ۱۴۰۵»)، `jalaliDayLabel` («یک‌شنبه ۱۵ شهریور»)، `jalaliIntlDate` (تاریخ کامل آماده با `fa-IR-u-ca-persian` — جفت Intl/date-fns-jalali تحقیق ۰۴ §۴)، `toPersianDigits`/`toEnglishDigits` (شامل ارقام عرب ٤-٦ برای ورودی کاربر)، `formatToman` (`Intl.NumberFormat('fa-IR')` + پسوند دستی «تومان»).
- نکتهٔ قراردادی مستندشده در JSDoc: `endOfJalaliMonth` ساعت 23:59:59.999 می‌دهد؛ برای کوئری بازه، بالای انحصاری `startOfJalaliMonth(addJalaliMonths(d, 1))` توصیه می‌شود.

**تست‌ها (۱۷ واحد، `tests/unit/jalali.test.ts`):** چک‌لیست تحقیق ۰۴ کامل — monthKey روی مرزهای سال (نوروز ۱۴۰۴/۱۴۰۵، ۳۰ اسفند کبیسه، ۳۱ مرداد/۱ شهریور)؛ کبیسهٔ ۱۴۰۳ (اسفند ۳۰) در برابر ۱۴۰۴/۱۴۰۵ (۲۹)؛ clamp `+12M` از ۳۰ اسفند ۱۴۰۳ → `1404-12-29`؛ **رندتریپ تمام ۲۳٬۷۳۸ روز ۱۹۹۶–۲۰۶۰**؛ **سازگاری دو موتور مستقل**: jalaali-js (پشت date-fns-jalali) در برابر ICU persian (پشت Intl) روی کل بازه = صفر اختلاف؛ مرز تهران/UTC (۲۰:۳۰Z = ۱ شهریور در تهران، ۱۹:۰۰Z هنوز ۳۱ مرداد؛ مسیر default-now با fake timers)؛ ارقام فارسی/تومان با طلایی‌های دقیق. آستانهٔ ۹۰/۸۵ فعال شد — واقعی **۱۰۰/۱۰۰**.

**react-multi-date-picker:** نصب شد و سازگاری React 19 با اسموک jsdom اثبات شد (رندر با `calendar={persian}` + `locale={persian_fa}` → ورودی «۱۴۰۵/۰۶/۱۵»)؛ مصرف واقعی در فرم با تیکت ۲۷. **انحراف کوچک ثبت‌شده:** `react-date-object@2.1.9` (وابستگی transitively پیکر) **به‌عنوان وابستگی مستقیم** اضافه شد — چیدمان سخت‌گیرانهٔ pnpm اجازهٔ import از بستهٔ transitive را نمی‌دهد و تقویم رسمی `persian` (هرگز `jalali`) از همین مسیرها می‌آید. peer-dev های هشدار pre-existing (vitest↔better-auth/@types/node) — ربطی به React 19 ندارند.

**گام بعدی:** frontier = [تیکت ۲۱](21-categorization-engine-seed-lexicon.md) (موازی آزاد)؛ [تیکت ۲۲](22-category-expense-services-learning.md) تا رزول ۲۱ گاز می‌خورد.
