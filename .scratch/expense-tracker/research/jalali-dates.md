# پژوهش: ابزار تاریخ جلالی — date-fns-jalali + react-multi-date-picker + Intl

تاریخ پژوهش: 2026-09-06. نسخه‌ها مستقیماً از npm registry، مستندات رسمی هر دو کتابخانه و MDN استخراج شده؛ رفتارهای کلیدی علاوه بر سورس، **با اجرای واقعی** (`date-fns-jalali@4.4.0-0` و `react-date-object@2.1.9` روی Node 24) هم تأیید شده‌اند.

## TL;DR — توصیه

1. **اصل «ذخیره میلادی، نمایش جلالی» را تثبیت کن:** تاریخ هر خرج به‌صورت رشتهٔ date-only میلادی `YYYY-MM-DD` ذخیره می‌شود (DB، state، سینک). تبدیل به جلالی فقط در لایهٔ نمایش/گروه‌بندی رخ می‌دهد.
2. **منطق تقویم = `date-fns-jalali` (نسخه `^4.4.0-0`).** fork کامل date-fns v4 است که همهٔ helper ها (startOfMonth، getDaysInMonth، format، parse، addMonths و ۲۰۰+ تابع دیگر) را روی *ماه جلالی* عمل می‌کنند. بدون هیچ وابستگی، ESM+CJS+Types، و tree-shakeable.
3. **انتخاب تاریخ در فرم = `react-multi-date-picker` (نسخه `^4.5.2`).** با `calendar={persian}` و `locale={persian_fa}` نمایش جلالی می‌دهد ولی state را با `onChange={d => setValue(d.toDate())}` میلادی نگه می‌دارد. peer dep آن `react >= 16.8.0` است → با React 19 بدون هیچ تنظیم اضافه‌ای نصب می‌شود.
4. **ارقام فارسی و مبالغ = `Intl.NumberFormat('fa-IR')`.** date-fns-jalali خروجی را با ارقام لاتین می‌دهد؛ ارقام فارسی وظیفهٔ Intl است (یا picker که خودش ارقام فارسی دارد).
5. یک ماژول کوچک `jalali-date.ts` (امضای توابع در بخش ۶) همهٔ تبدیل‌ها را پشت یک API می‌برد؛ هیچ‌جای دیگر اپ مستقیماً از date-fns-jalali import نمی‌کند.

## 1. نسخه‌ها و سازگاری (2026-09-06)

| پکیج | نسخه | نکات | منبع |
|---|---|---|---|
| date-fns-jalali | 4.4.0-0 (2026-05-31) | mirrorِ date-fns **4.4.0** است (طرح نسخه: نسخهٔ date-fns + پسوند `-0`)؛ MIT؛ بدون وابستگی؛ `exports` ESM+CJS+types دارد | [npm](https://www.npmjs.com/package/date-fns-jalali), [GitHub](https://github.com/date-fns-jalali/date-fns-jalali) |
| react-multi-date-picker | 4.5.2 (2024-06-15) | MIT؛ peerDeps: `react` و `react-dom` **`>=16.8.0`** → React 19 مشکلی ندارد؛ deps: `react-date-object@^2.1.8`، `react-element-popper@^2.1.6`؛ بدون CSS import اجباری (استایل پیش‌فرض داخلی است) | [npm](https://www.npmjs.com/package/react-multi-date-picker), [docs](https://shahabyazdi.github.io/react-multi-date-picker/installation/) |
| react-date-object | 2.1.9 | وابستگی transitively نصب می‌شود؛ فقط اگر مستقیم DateObject ساختیم import می‌کنیم | [GitHub](https://github.com/shahabyazdi/react-date-object) |

اندازهٔ باندل (bundlephobia API): react-multi-date-picker کل پکیج ≈ **23.4KB gzip** (75.3KB min، ۲ وابستگی)؛ date-fns-jalali کل کتابخانه ≈ 18.7KB gzip ولی فقط توابع import شده باندل می‌شوند (tree-shaking)؛ react-date-object ≈ 6.4KB gzip.

- پروژهٔ date-fns-jalali فعال است (4.4.0-0 فقط ۲ روز بعد از date-fns 4.4.0 منتشر شده). react-multi-date-picker از 2024-06 آپدیت نشده ولی پایدار است و استفادهٔ وسیعی دارد؛ با React 19 سازگار است چون از API های حذف‌شده استفاده نمی‌کند و peer range آن باز است (از registry تأیید شد، نه شایعات «فقط تا React 18»).

## 2. date-fns-jalali — API مورد نیاز ما

**نکتهٔ کلیدی معماری:** fork با override کردن `_core` (getFullYear/getMonth/setDate/…) و الگوریتم [jalaali-js](https://github.com/jalaali/jalaali-js) کار می‌کند؛ یعنی ورودی/خروجی توابع همان `Date` میلادی است، ولی «ماه» و «سال» و «روزِ ماه» از دید جلالی خوانده/نوشته می‌شود. پس همهٔ الگوهای آشنای date-fns عیناً جلالی می‌شوند. ([سورس _core](https://github.com/date-fns-jalali/date-fns-jalali/tree/master/src/_core))

رفتارهای تأییدشده با اجرا (`d = new Date(2026, 8, 6)` = 15 شهریور 1405):

| کار | فراخوانی | نتیجه |
|---|---|---|
| کلید ماه (گروه‌بندی) | `format(d, 'yyyy-MM')` | `'1405-06'` |
| فرمت عددی | `format(d, 'yyyy-MM-dd')` | `'1405-06-15'` (ارقام لاتین) |
| نام ماه/روز هفته | `format(d, 'd MMMM yyyy، EEEE')` | `15 شهریور 1405، یک‌شنبه` |
| آغاز ماه | `startOfMonth(d)` | 1405-06-01T00:00 (میلادی: 2026-08-23) |
| پایان ماه | `endOfMonth(d)` | 1405-06-31T23:59:59.999 |
| تعداد روز ماه | `getDaysInMonth(d)` | `31` |
| اسفند کبیسه/عادی | `getDaysInMonth(newDate(1403,11,1))` / `(1405,11,1)` | `30` / `29` |
| ساخت از جلالی | `newDate(1405, 5, 15)` | `Sun Sep 06 2026` (ماه **صفر-پایه**!) |
| پارس جلالی | `parse('1405/06/15', 'yyyy/MM/dd', new Date())` | 2026-09-06 |
| پارس ISO میلادی | `parseISO('2026-09-06')` | نیمه‌شب **محلی** (نه UTC) |
| یکسان بودن ماه | `isSameMonth(a, b)` | بولین جلالی |
| فاصلهٔ ماه | `differenceInCalendarMonths(a, b)` | اسفند→فروردین = `1` |
| ناوبری ماه | `addMonths(d, n)` | clamp دارد: `1403-12-30 +1M → 1404-01-30`، `+1y → 1404-12-29` |
| شبکهٔ روزهای ماه | `eachDayOfInterval({start: startOfMonth(d), end: endOfMonth(d)})` | ۳۱ Date |
| آغاز هفته | `startOfWeek(d)` | شنبه (locale fa-IR هفته را از شنبه شروع می‌کند) |
| اجزای جلالی | `getYear/getMonth/getDate(d)` | `1405 / 5 (صفر-پایه) / 15` |

- **locale پیش‌فرض همین `fa-IR` است** — نام ماه و روز فارسی بدون import اضافه؛ `enUS` و `fa-jalali-IR` هم موجودند ([سورس locale/_default](https://github.com/date-fns-jalali/date-fns-jalali/blob/master/src/locale/_default/index.ts)).
- خروجی همیشه **ارقام لاتین** دارد (تأیید با اجرا). ارقام فارسی را Intl یا تبدیل دستی می‌سازد (بخش 4).
- فرمت full: `endOfMonth` ساعت 23:59:59.999 می‌دهد — برای کوئری/فیلتر بازه بهتر است `< startOfMonth(nextMonth)` استفاده شود تا شناور نباشد.

الگوی گروه‌بندی خرج‌ها بر اساس ماه جلالی:

```ts
import { format, startOfMonth, isSameMonth } from 'date-fns-jalali';

// کلید گروه: '1405-06' — رشته و مرتب‌سازی لغگانی درست است (سال‌ها ۴ رقمی)
const monthKey = (spentAt: Date) => format(spentAt, 'yyyy-MM');

// مرز ماه برای کوئری Dexie/SQLite (روی رشتهٔ ISO مقایسه می‌کنیم)
const gte = format(startOfMonth(new Date()), 'yyyy-MM-dd');        // '1405-06-01'
```

## 3. react-multi-date-picker در فرم RTL

الگوی کامل «میلادی در state، جلالی در UI» (مطابق [docs calendars](https://shahabyazdi.github.io/react-multi-date-picker/calendars/) و [events](https://shahabyazdi.github.io/react-multi-date-picker/events/)):

```tsx
import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';

<DatePicker
  value={value}                        // Date میلادی از state
  calendar={persian}                   // نمایش جلالی
  locale={persian_fa}                  // نام ماه‌ها + ارقام فارسی (داخلی همین locale است)
  calendarPosition="bottom-right"      // پیش‌فرض bottom-left است؛ برای RTL راست
  onChange={(dateObj) => setValue(dateObj.toDate())}
/>
```

- `onChange` در حالت single یک **DateObject** می‌دهد نه Date؛ `dateObj.toDate()` همان لحظهٔ زمانی به‌صورت `Date` میلادی می‌دهد (رفت‌وبرگشت `getTime() === input.getTime()` با اجرا تأیید شد). همین یعنی state اپ همیشه میلادی می‌ماند.
- **حتماً `persian` نه `jalali`:** docs می‌گوید تقویم `jalali` محاسبهٔ متعارف (conventional) است و ممکن است یک روز با تقویم رسمی اختلاف بگیرد؛ `persian` همان تقویم رسمی/رسم‌الخطی ایران است.
- plugins با مسیرهای مستقل import می‌شوند و tree-shakeable اند: `react-multi-date-picker/plugins/toolbar` (دکمهٔ امروز/تأیید)، `/weekends`، `/date_panel`، … ([docs plugins](https://shahabyazdi.github.io/react-multi-date-picker/plugins/)). مثال: `plugins={[<Toolbar position="bottom" />]}`.
- قالب نمایش input با prop `format` (پیش‌فرض `'YYYY/MM/DD'`) و ارقام با locale تعیین می‌شود؛ `formattingIgnoreList` و `digits` هم هست.
- استایل پیش‌فرض بدون CSS import کار می‌کند؛ فقط قالب‌های موبایل/رنگی اختیاری import دارند (`styles/…`).
- برای React Hook Form صفحهٔ مستند جدا دارد؛ محدودیت known ندارد.

## 4. Intl — تقسیم کار با date-fns-jalali

| نیاز | ابزار | نمونهٔ خروجی (تأیید با اجرا) |
|---|---|---|
| ارقام فارسی برای مبلغ | `new Intl.NumberFormat('fa-IR').format(1234567.5)` | `۱٬۲۳۴٬۵۶۷٫۵` |
| مبلغ تومان | عدد با NumberFormat + پسوند دستی «تومان» (تومان در ISO currency نیست؛ `currency:'IRR'` «ریال» می‌دهد) | `۱٬۲۳۴٬۵۶۷ تومان` |
| رشتهٔ تاریخ آمادهٔ کامل | `new Intl.DateTimeFormat('fa-IR-u-ca-persian', {dateStyle:'full'}).format(d)` | `۱۴۰۵ شهریور ۱۵, یکشنبه` |
| همان با ارقام لاتین | اکستنشن `-nu-latn` یا `numberingSystem:'latn'` | `1405/6/15` |

- `fa-IR-u-ca-persian` = locale + اکستنشن یونیکد `ca`(calendar)=persian؛ معادل options `{calendar:'persian'}` (option اولویت دارد). `resolvedOptions().calendar === 'persian'` و `numberingSystem === 'arabext'` (پیش‌فرض fa). ([MDN DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/DateTimeFormat))
- Node 24 و مرورگرهای فعلی full-ICU دارند؛ تقویم persian و `Intl.supportedValuesOf('calendar')` در همهٔ runtime های هدف ما هست.
- **تقسیم کار:** هر جا «محاسبه/مقایسه/الگوی سفارشی/پارس» هست → date-fns-jalali؛ هر جا فقط «رشتهٔ نمایشی نهایی» (مبلغ، یا یک خط تاریخ در tooltip) → Intl. ارقام فارسی همیشه از Intl (یا map دستی) می‌آید، نه از date-fns-jalali.
- **سازگاری دو موتور:** ICU (پشت Intl) و jalaali-js (پشت date-fns-jalali) را روی ۲۴,۱۰۷ روز متوالی (1996-01-01 تا 2060-12-31) با هم مقایسه کردم: **صفر اختلاف**. پس ترکیب Intl برای نمایش و date-fns-jalali برای منطق امروز امن است؛ باز هم اگر روزی mismatch گزارش شد، نمایش تاریخ را هم یکدست روی date-fns-jalali ببر.

## 5. گودال‌های شناخته‌شده

1. **تاریخ بدون ساعت — فقط با یک قاعده:** ذخیره `YYYY-MM-DD` میلادی؛ ساخت Date با `parseISO` (نیمه‌شب محلی) یا `new Date(y, m-1, d)`. هرگز `new Date('2026-09-06')` ننویسید — این یکی UTC پارس می‌کند و در هر tz غیر ایران/منفی یک روز شیفت می‌خورد. چون اپ ایران-محور است (+03:30 و DST ایران از 1401 لغو شده)، نیمه‌شب محلی پایدار است.
2. **مرز اسفند/فروردین:** کلید `'yyyy-MM'` و `differenceInCalendarMonths` اینجا درست کار می‌کنند (تأیید: اسفند→فروردین = 1)؛ خطر واقعی `addMonths` از ۳۰ اسفند سال کبیسه است که clamp می‌شود (→ ۳۰ فروردین) و `addYears` از ۳۰ اسفند → ۲۹ اسفند. این دو را تست کنید.
3. **کبیسه:** الگوریتم jalaali-js با جدول شکست‌های ۳۳ ساله؛ بازهٔ معتبر سال -61 تا 3177. ماه‌های ۱–۶ = ۳۱ روز، ۷–۱۱ = ۳۰، اسفند = ۲۹ یا ۳۰ (کبیسه: 1403 ✓، بعدی 1408). «اختلاف ۶۳ ساله» یعنی آفست ثابت سال جلالی/میلادی (2026−621=1405) — با توابع بالا مستقیم سراغش نمی‌رویم؛ همیشه با Date کار کنید نه جمع/تفریق دستی سال.
4. **دو تقویم هم‌نام در react-date-object:** `calendars/persian` (رسمی) و `calendars/jalali` (متعارف، ممکن است یک‌روزه اختلاف کند). فقط `persian` را در کل اپ استفاده کنید تا با date-fns-jalali و Intl ناسازگار نشود.
5. **ارقام فارسی در ورودی کاربر:** اگر جایی تاریخ/مبلغ از input متنی می‌آید، قبل از parse با `toEnglishDigits` (۰-۹ و ۰-۹ عرب) نرمال کنید؛ date-fns `parse` ارقام فارسی را نمی‌شناسد.
6. **فرانسهٔ صفرing:** `yyyy-MM` صفردار است و کلید مقایسه‌پذیر؛ ولی `format(d,'yyyy-M-d')` صفردار نیست — برای کلید/ذخیره همیشه صفردار.

## 6. ماژول پیشنهادی `apps/web/src/lib/jalali-date.ts` (یا packages/shared)

تنها نقطهٔ import از date-fns-jalali در اپ. امضای توابع:

```ts
// تبدیل پایه
export const toISODate = (d: Date): string;                    // '2026-09-06'
export const fromISODate = (iso: string): Date;                // parseISO → نیمه‌شب محلی

// گروه‌بندی و مرز ماه جلالی
export const jalaliMonthKey = (d: Date): string;               // '1405-06' — کلید گروه/مرتب‌سازی
export const startOfJalaliMonth = (d: Date): Date;             // startOfMonth
export const endOfJalaliMonth = (d: Date): Date;
export const jalaliDaysInMonth = (d: Date): number;
export const addJalaliMonths = (d: Date, n: number): Date;     // ناوبری ماه‌ها در UI

// نمایش
export const jalaliMonthLabel = (d: Date): string;             // 'شهریور ۱۴۰۵'
export const jalaliDayLabel = (d: Date): string;               // 'شنبه ۱۵ شهریور'
export const formatJalali = (d: Date, pattern?: string): string; // پیش‌فرض 'yyyy/MM/dd'
export const toPersianDigits = (v: string | number): string;   // map دستی 0-9 → ۰-۹
export const toEnglishDigits = (s: string): string;            // نرمال‌سازی ورودی کاربر
export const formatToman = (amount: number): string;           // Intl.NumberFormat('fa-IR') + ' تومان'
```

پیاده‌سازی هر تابع ۱–۳ خط است (wrapper روی date-fns-jalali/Intl)؛ بهای این ماژول: جابه‌جایی کتابخانه یا تغییر قاعدهٔ tz فقط یک فایل را لمس می‌کند.

## 7. چک‌لیست تست (Vitest)

- مرزهای اسفند/فروردین: `endOfMonth` کبیسه 1403 = 1403-12-30، عادی 1405 = 1405-12-29؛ `addMonths(newDate(1403,11,30),1) = 1404-01-30`؛ `addYears(...,1) = 1404-12-29`.
- گروه‌بندی: خرج 29 اسفند و 1 فروردین در دو کلید متفاوت؛ مرتب‌سازی کلیدها.
- `fromISODate`/`toISODate` رفت‌وبرگشت؛ پارس `new Date('...')` ممنوع (لینت/کدریویو).
- نرمال‌سازی ارقام فارسی/عرب در ورودی.
- یک snapshot از `formatJalali` برای تاریخ‌های نمونه (حلقهٔ سال نو 2027–2041).

## منابع

- [npm: date-fns-jalali](https://www.npmjs.com/package/date-fns-jalali) و [GitHub/date-fns-jalali](https://github.com/date-fns-jalali/date-fns-jalali) — README، `src/_core/*`، `src/_jalali/index.ts` (کپی jalaali-js)، `src/locale/fa-IR/*`
- [npm: react-multi-date-picker](https://www.npmjs.com/package/react-multi-date-picker) و [docs رسمی](https://shahabyazdi.github.io/react-multi-date-picker/) — installation، calendars، events، plugins، props
- [npm: react-date-object](https://www.npmjs.com/package/react-date-object)، [bundlephobia API](https://bundlephobia.com/) (اندازهٔ باندل، 2026-09-06)
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/DateTimeFormat) (calendar/numberingSystem)، [MDN: Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NumberFormat)
- [jalaali-js](https://github.com/jalaali/jalaali-js) — الگوریتم مرجع تبدیل و کبیسه
- اجرای تأییدی: Node 24.4، `date-fns-jalali@4.4.0-0` + `react-date-object@2.1.9`، 2026-09-06 (خروجی‌های نقل‌شده در متن از همین اجراست)
