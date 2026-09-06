# 09 — راه‌اندازی Turso (libSQL) + Drizzle در Next.js

Type: research
Status: resolved
Blocked by: —

## Question

کاربر دیتابیس را صریحاً انتخاب کرد: **Turso (libSQL) با Drizzle ORM** روی اکانت رایگان (2026-09-06). مقایسهٔ سرویس‌ها منتفی است؛ این تحقیق باید «چطور درست راه‌اندازی کنیم» را با منابع رسمی و وضعیت 2026-09 جواب بدهد:

- وضعیت فعلی پلتفرم Turso: پلن رایگان (سقف‌ها: دیتابیس، حجم/ردیف، درخواست، sleep)، ریجن‌ها و نزدیک‌ترین ریجن به کاربر در ایران، توکن‌ها (platform token در برابر database token) و ریسک‌های عملی دسترسی/ثبت‌نام از ایران — فقط مستند رسمی/گزارش تأییدشده، به‌عنوان ریسک ثبت شود، بدون هیچ توصیهٔ دورزدن.
- Drizzle روی libSQL: درایور درست (`drizzle-orm/libsql` + `@libsql/client`) — remote (HTTP/webSocket) در برابر embedded replica در برابر فایل لوکال؛ نسخهٔ فعلی و پایداری هر مسیر روی ویندوز.
- جریان migration با drizzle-kit برای libSQL: generate/migrate/push در برابر Turso، و اجرای migration در دیپلوی (مثلاً Vercel) — الگوی توصیه‌شده.
- استوری توسعه و تست لوکال: `turso dev` در برابر فایل libSQL لوکال در برابر embedded replica — کدام برای dev روزمره و کدام برای تست integration (ورودی تیکت ۱۱)؛ پاریتی schema بین لوکال و ریموت.
- قفل‌شدگی و خروج: مسیر اکسپورت (dump به SQLite/Postgres) و اینکه embedded replica چه حاشیه‌امنیتی می‌دهد.
- خروجی: توصیهٔ پیکربندی نهایی (درایور per-context: dev/test/prod) با کد آمادهٔ `src/db`.
- مقصد یافته‌ها: `.scratch/expense-tracker/research/turso-drizzle.md`

## Answer

یافتهٔ کامل با منابع و دو آزمون اجرایی روی ویندوز: [../research/turso-drizzle.md](../research/turso-drizzle.md).

**پیکربندی توصیه‌شده per-context** — همه‌جا `drizzle-orm/libsql` + `@libsql/client` (node) و فقط URL عوض می‌شود:
- **dev:** `TURSO_DATABASE_URL=file:./local.db` بدون توکن — فایل لوکال (تأیید اجرایی روی ویندوز؛ پیش‌ساخت رسمی `@libsql/win32-x64-msvc` دارد، بدون node-gyp).
- **test:** فایل temp per-run + اعمال migrationها با `drizzle-orm/libsql/migrator` — بدون شبکه و بدون مصرف سقف Turso.
- **prod (Vercel):** `libsql://<db>-<org>.turso.io` + database token در `TURSO_AUTH_TOKEN` — اتصال HTTP ریموت (embedded replica روی Vercel منتفی است: filesystem پایدار ندارد).

**Migrationها:** `drizzle-kit generate` (کامیت فایل‌های SQL) + `drizzle-kit migrate`؛ config با `dialect: 'turso'` که برای فایل لوکال هم کار می‌کند (تأیید اجرایی). الگوی رسمی Turso برای Vercel: `"build": "drizzle-kit migrate && next build"`؛ برای تک‌کاربر اجرای دستی `pnpm db:migrate` امن‌تر است.

**واقعیت پلن رایگان (2026-09-06):** 100 دیتابیس، 5GB، 500M read/ماه، 10M write/ماه، 3GB sync/ماه، PITR 1 روز، بدون کارت بانکی. دو تله: رد شدن سقفِ هر معیار → **BLOCKED** کامل (بدون overage در Free) و آرشیو خودکار پس از **10 روز بی‌فعالیتی** (`turso group unarchive`). برای کاربر تکی با ایندکس درست، به‌وفور کافی است.

**ریسک‌های کلیدی:** (۱) **ایران** — Turso شرکت آمریکایی است؛ هیچ سیاست عمومی مکتوبی دربارهٔ ایران پیدا نشد (عدم قطعیت صریح) → ثبت‌نام/دسترسی/پرداخت باید اول از همه عملاً تست شود؛ پرداخت آینده به کارت بین‌المللی نیاز دارد؛ در طراحی وابستگی به Turso کمینه شده و خروج با `turso db export` (فایل SQLite معمولی) یک دستوری است. (۲) enforcement کلید خارجی به‌صورت پیش‌فرض خاموش است → قاعدهٔ «منع حذف دستهٔ پُر» باید در لایهٔ اپ تضمین شود. (۳) نسخه‌ها: drizzle-orm 0.45.2، drizzle-kit 0.31.10، @libsql/client 0.18.0. (۴) فهرست دقیق ریجن‌ها هنوز از منبع در دسترس نبود → هنگام ثبت‌نام با `turso db locations --show-latencies` انتخاب شود.
