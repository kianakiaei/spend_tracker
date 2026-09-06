# 12 — تثبیت معماری نهایی و قرارداد API موبایل

Type: grilling
Status: resolved
Blocked by: 09, 10
Assignee: IDEHAL (agent session, 2026-09-06)

## Question

با توصیه‌های تحقیق‌های ۰۹ و ۱۰، تصمیم‌های باقی‌ماندهٔ استک را با کاربر تثبیت کن (HITL):

- Turso (libSQL) + Drizzle انتخاب کاربر است — فقط نکات باز تحقیق ۰۹ (ریجن، توکن‌ها، dev/test/prod config) را تأیید کن.
- مرز Server Actions در برابر Route Handler؛ شکل REST نسخه‌دار برای موبایل: منابع، قرارداد خطا، نسخه‌بندی، auth موبایل (توکن؟) — و اینکه آیا ایدهٔ opId/idempotency از قرارداد سینک باطل‌شدهٔ تیکت ۰۵ در API هم می‌آید.
- انتخاب کتابخانهٔ auth (better-auth در برابر گزینه‌های تحقیق ۱۰) — ورودی تیکت «Auth و سشن در Next.js».
- جای اسکیماها، موتور دسته‌بندی و ماژول جلالی در ساختار تک‌اپ Next.js؛ آستانهٔ پوشش تستِ پیشنهادی تحقیق ۱۱ را کاربر تأیید کند.
- از تیکت ۰۶ (سرریز به قرارداد API): سرویس مشترک دسته‌بندی با یادگیری سمت سرور هنگام ذخیرهٔ خرج + endpoint بی‌اثر `POST /api/v1/classify` برای موبایل آینده — شکل دقیق endpoint (متد، ورودی، پاسخ با سطح اطمینان) در همین تیکت تثبیت شود.

## Answer

تصمیم‌های کاربر (گریلینگ، 2026-09-06) — هر نه سؤال راند اول صریحاً تأیید شد؛ frontier خالی بود.

**Turso — تأیید بستهٔ تحقیق ۰۹ + تأکید کاربر:**
- سه context، یک درایور (`drizzle-orm/libsql` + `@libsql/client` 0.18.0): dev = `file:./local.db` بدون توکن؛ تست integration = فایل موقتی per-run + migrator بدون شبکه؛ prod = `libsql://…` + database token.
- **تأکید صریح کاربر: dev و تست هرگز به Turso نمی‌زنند** — فایل لوکال، صفر مصرف از سقف رایگان؛ اتصال ریموت فقط prod.
- ریجن: انتخاب زودهنگام نه — لحظهٔ ثبت‌نام با `turso db locations --show-latencies` (یافتهٔ زنده: کدها شکل `aws-*`).
- توکن: database token با `--expiration never` برای prod + read-only برای ad-hoc؛ هر دو فقط یک‌بار نمایش داده می‌شوند → مستقیم به `.env` (هرگز کامیت نمی‌شوند).
- ریسک دسترسی از ایران: اولین گام عملی پیاده‌سازی تست شود؛ شکست → تصمیم محصولی تعویض سرویس (جانشین ساده: فایل libSQL روی هاست اپ).

**دیپلوی:** Vercel hobby پیش‌فرض؛ self-host (`next start`/Docker پشت reverse proxy) پلن B؛ تست دسترسی عملی موقع دیپلوی.

**مرز API و نسخه‌بندی:** هر CRUD دامنه = Route Handler زیر `app/api/v1/...` (auth/اعتبارسنجی/خطای یکسان)؛ Server Action فقط شکرِ فرم وب و بدنش صدا زدن همان سرویس دامنه است (منطقِ فقط-اکشن = باگ قرارداد)؛ RSC هرگز Route Handler خود را fetch نمی‌کند — مستقیم `db`/سرویس؛ کلاینتِ وب هم از fetch wrapper تایپ‌شده به همان `/api/v1` می‌رود (یک مسیر). نسخه‌بندی: تغییر additive داخل v1؛ breaking = پیشوند `v2` هم‌دوش v1؛ `proxy.ts` جای redirect/deprecation.

**سطح منابع REST (قرارداد موبایل):** `expenses` (POST؛ GET با فیلتر `month`؛ GET/PATCH/DELETE روی `[id]`)، `categories` (GET/POST؛ PATCH/DELETE روی `[id]` با 409 برای حذف پُر؛ `POST [id]/move-expenses` با `{"targetCategoryId"}` برای انتقال گروهی)، `recurring-templates` (GET/POST؛ PATCH/DELETE روی `[id]`)، `summaries` (GET با فیلتر `month`)، `classify` (POST)، و auth = mount خود better-auth در `app/api/auth/[...all]` (بیرون v1، قرارداد خودش). بدون صفحه‌بندی در v1 — الگوی مصرف همیشه «یک ماه» است؛ `limit/cursor` در صورت نیاز additive اضافه می‌شود.
- شکل `GET /api/v1/summaries?month=1405-06`: `{ monthKey, totalToman, byCategory: [{ categoryId, name, totalToman, count }] }` — موبایل همان جمع/تفکیک داشبورد را می‌گیرد؛ سرویس جمع مشترک است (RSC و handler هر دو از آن می‌خوانند).

**خطا/idempotency/هم‌زمانی:** خطا = problem+json (RFC 9457) با اعضای `type/title/status/detail` + آرایهٔ `errors` (path/code/message) برای اعتبارسنجی؛ 400 فیلد نامعتبر، 401 بدون سشن، 404 id ناشناخته، **409 حذف دستهٔ دارای خرج**، 500 بدون درز دادن پیام داخلی. opId/Idempotency-Key وارد v1 نمی‌شود (مال قرارداد سینک باطل‌شده بود) — idempotency تولید الگو در یونیک‌ایندکس `(userId, sourceRecurringId, monthKey)` زندگی می‌کند؛ دابل‌تپ سمت کلاینت حل می‌شود. ستون `updatedAt` می‌ماند ولی If-Match/412 در v1 نیست (last-write-wins برای کاربر تکی)؛ هر دو مسیر additive باز.

**Auth:** **better-auth 1.7.3** — آداپتور Drizzle (provider: sqlite)، ایمیل+رمز داخلی، پلاگین `bearer()` برای موبایل، `nextCookies()` برای وب؛ mount در `app/api/auth/[...all]`. عدم‌قطعیتِ مستند نشدن libSQL در آداپتور → smoke test ثبت‌نام/ورود روی دیتابیس لوکال اولین گام پیاده‌سازی. جزئیات سشن (انقضا، محافظت مسیر، UX ورود) → تیکت «Auth و سشن در Next.js».

**ساختار تک‌اپ:** `src/app` (صفحات RSC + کلاینت‌کامپوننت‌ها)؛ `src/app/api/v1/…` (handler نازک: parse → سرویس → پاسخ)؛ `src/app/api/auth/[...all]`؛ `src/db` (`schema.ts` + `index.ts` singleton ضد-HMR)؛ `src/lib/schemas` (Zod: DTO + قیود دامنه، مشترک بین handler/سرویس/کلاینت)؛ `src/lib/services` (expense/category/recurring/summary + یادگیری هنگام ذخیره)؛ `src/lib/categorization` (موتور خالص + واژه‌نامهٔ سیستمی)؛ `src/lib/jalali` (ماژول واحد تاریخ). قاعدهٔ تست‌پذیری: `lib/` و `services/` هرگز از `next/*` import نمی‌کنند.

**classify:** `POST /api/v1/classify` با بدنهٔ `{ "title": "…" }` → 200 همیشه با `{ categoryId, source: 'learned' | 'system' | 'fallback', matchedKey: string | null, confidence: { purity, support } | null }`؛ بی‌اثر است (یادگیری فقط هنگام ذخیرهٔ خرج در سرویس خرج)؛ fallback = پربسامدترین دستهٔ خود کاربر با `confidence: null`؛ 401/400 طبق قرارداد.

**آستانه‌های تست (تأیید تحقیق ۱۱):** per-glob — `categorization`/`jalali`/`recurring` ≥90% خط و ≥85% شاخه؛ `services` ≥80/75؛ UI بدون آستانه (پوشش با E2E)؛ CI = GitHub Actions بدون service container؛ vitest 5.0.0 با عقب‌نشینیِ ثبت‌شده به 4.x در صورت friction.

**پیامد روی fog:** «مقصد دیپلوی/ریجن/سکرت‌ها»، «تولید خودکار الگوها» و «پیش‌نمایش اقساط» با تثبیت معماری شارپ شدند → تیکت‌های ۱۴/۱۵/۱۶ ساخته شدند؛ تیکت «Auth و سشن در Next.js» حالا آزاد است.
