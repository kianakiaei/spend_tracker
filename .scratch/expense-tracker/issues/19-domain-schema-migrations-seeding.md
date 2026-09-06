# 19 — اسکیمای دامنه + مهاجرت افزایشی + seed دسته‌های سیستمی

Type: task
Status: resolved
Blocked by: 18
Assignee: IDEHAL (agent session, 2026-09-06)

## Question

موجودیت‌های دامنه روی همان `src/db/schema.ts` (کنار جدول‌های auth تیکت ۱۸) با تصمیم‌های تیکت ۰۵ **+ اصلاح‌های ۱۴/۱۵**:

- `categories`: id (UUIDv7 — تولید در اپ)، name (یکتا برای هر کاربر)، icon?، color?، kind (`'system' | 'custom'`)، order، **slug (nullable — فقط شش سطر سیستمی ست می‌شود؛ پل کد↔دستهٔ تیکت ۱۳)**، userId، createdAt/updatedAt.
- `expenses`: id، amountToman (**int > 0**، صحیح تومان)، title، note?، categoryId (**NOT NULL** — گروه «بدون دسته» وجود ندارد)، `occurredAt` **nullable** (رشتهٔ date-only میلادی `'YYYY-MM-DD'`)، `monthKey` **همیشه پر** (`'1405-06'` جلالی — تاریخ‌دار: مشتق روی نوشتن از occurredAt؛ بی‌تاریخ: ست‌شونده در نوشتن از ماهِ فرم، تصمیم ۱۵)، sourceRecurringId?، userId، createdAt/updatedAt.
- `recurringTemplates`: id، title، amountToman، categoryId، dayOfMonth (۱..۳۱ جلالی)، startDate (date-only)، endDate?، active، userId، createdAt/updatedAt.
- `learnedKeys`: key (نرمال‌شده)، categoryId، count، source (`'learned'` فقط — کلیدهای سیستمی هرگز اینجا نمی‌آیند، تیکت ۱۳)، updatedAt، userId.
- ایندکس‌ها: **یونیک‌ایندکس `(userId, sourceRecurringId, monthKey)`** روی expenses (موتور idempotency تیکت ۱۴)؛ یونیک `(userId, name)` روی categories؛ ایندکس `(userId, monthKey)` روی expenses برای خواندن ماه؛ ایندکس `(userId, key)` روی learnedKeys.
- FK پیش‌فرض libSQL خاموش است (تحقیق ۰۹) → قاعده‌های «منع حذف دستهٔ پُر» و «سیستمی حذف‌نشدنی» در لایهٔ اپ (تیکت ۲۲) تضمین می‌شوند — اینجا فقط ستون‌ها.
- مهاجرت افزایشی با `drizzle-kit generate` (فایل‌های SQL کامیت می‌شوند) + اسکریپت `db:migrate`.
- **Seed شش دستهٔ سیستمی هنگام ثبت‌نام:** هوک `databaseHooks.user.create.after` در better-auth — از `SYSTEM_CATEGORIES` (تیکت ۱۳) با slug ست‌شده؛ نام فارسی، رنگ/ترتیب اولیه.
- پایهٔ Zod در `src/lib/schemas`: قیود دامنه (مبلغ صحیح مثبت، dayOfMonth ۱..۳۱، فرمت date-only، فرمت monthKey جلالی، kind) — DTOهای درخواست/پاسخ با تیکت ۲۵ می‌آیند.

## Test plan

- integration (فایل temp + migrator): ثبت‌نام → دقیقاً شش دستهٔ سیستمی با slug درست؛ تلاش INSERT تکراری خرجِ الگو با همان (userId, sourceRecurringId, monthKey) با `ON CONFLICT DO NOTHING` واقعاً no-op شود؛ قالب monthKey و محدودیت‌های Zod (مبلغ صفر/منفی رد، dayOfMonth ۳۲ رد).

## Answer

**تمام شد (2026-09-06) — سبز کامل: lint ✓ / tsc ✓ / vitest 50/50 ✓ (با آستانه‌های تازه) / e2e 2/2 ✓ / build ✓.** کامیت‌ها: `23903b0` (Zod پایه + UUIDv7) → `27e7e4d` (اسکیما + مهاجرت + seed) → `7588fc3` (آستانه‌های پوشش).

**اسکیما (`src/db/schema.ts` + مهاجرت `drizzle/0001_redundant_hulk.sql`):** چهار جدول دامنه کنار جدول‌های auth، عین تیکت — `categories` با kind/order/slug (nullable) و یونیک `(userId, name)`؛ `expenses` با amountToman int، occurredAt nullable (بی‌تاریخ، تیکت ۱۵)، monthKey همیشه‌پر، sourceRecurringId nullable + **یونیک‌ایندکس `(userId, sourceRecurringId, monthKey)`** و ایندکس خواندن ماه `(userId, monthKey)`؛ `recurringTemplates` با dayOfMonth/startDate/endDate/active؛ `learnedKeys` با count و source. نکته‌های پیاده‌سازی:

- **بدون FK روی جدول‌های دامنه** («اینجا فقط ستون‌ها») — قاعده‌های منع حذف پُر/سیستمی حذف‌نشدنی با تیکت ۲۲ در لایهٔ اپ.
- **انحراف ثبت‌شدهٔ کوچک:** تیکت برای learnedKeys «ایندکس (userId, key)» می‌گفت؛ پیاده‌سازی آن را **کلید اصلی مرکب `(userId, key)`** کرد — همان ایندکس را می‌سازد ولی هویت ردیف را هم تضمین می‌کند (یک شمارنده به‌ازای هر کاربر+کلید، پیش‌نیاز upsert یادگیری تیکت ۲۲). جدول طبق لیست ستون‌های تیکت، بدون ستون id.
- NULL در sourceRecurringId در ایندکس یونیک مجزا حساب می‌شود (رفتار SQLite) — خرج‌های دستی هرگز با موتور idempotency تصادم نمی‌کنند.
- ستون `order` کوتو‌شده در DRL تولیدی؛ seed هنگام ثبت‌نام با onConflictDoNothing روی یونیک (userId, name) دوباره‌اجرایی است.

**Seed شش دستهٔ سیستمی:** `databaseHooks.user.create.after` در `src/lib/auth.ts` → `seedSystemCategories(userId)` در `src/lib/services/`؛ نام فارسی + slug + ترتیب ۰..۵ + رنگ اولیهٔ دلخواه (#2f9e6e جواهری برای خوراکی طبق جهت UI تیکت ۰۷ و پنج رنگ هماهنگ)؛ خطای seed عمداً propagate می‌شود (کاربر بی‌دسته = ثبت‌نام شکست‌خورده بهتر است)؛ هر seed یک INSERT اتمی شش‌ردیفه است. `src/lib/categorization/seed-lexicon.ts` **با محتوای کامل تیکت ۱۳** (SYSTEM_CATEGORIES + SEED_LEXICON، ۷۴ کلید) ساخته شد — تیکت ۲۱ فقط موتور و تست‌هایش را می‌سازد.

**Zod پایه (`src/lib/schemas/domain.ts`):** `amountTomanSchema` (int > 0)، `jalaliMonthKeySchema` (`'1405-06'`، ماه 01-12)، `dateOnlySchema` (میلادی `'YYYY-MM-DD'` — سطح قالب: ماه 01-12 و روز 01-31؛ اعتبار تقویم واقعی کارِ date-picker و سرویس‌هاست)، `dayOfMonthSchema` (۱..۳۱)، `categoryKindSchema`، `learnedKeySourceSchema` (فقط `'learned'`)، `uuidv7Schema`. DTOها با تیکت ۲۵ روی همین‌ها سوار می‌شوند. `src/lib/id.ts` → `newId()` = UUIDv7 دستیِ RFC 9562 (48 بیت زمان + version/variant) با WebCrypto — بدون وابستگی جدید، سازگار node/مرورگر.

**تست‌ها (TDD دو درز):** unit — جدول‌های رد/قبول قیود Zod + خواص newId (نسخهٔ 7، variant، زمان 48 بیتی، یکتایی 100تایی)؛ integration (`tests/integration/domain-schema.test.ts` روی فایل temp + migrator، الگوی تیکت ۱۸) — ثبت‌نام → **دقیقاً شش دستهٔ سیستمی** با slug/نام/ترتیب/رنگ/UUIDv7 درست؛ `ON CONFLICT DO NOTHING` روی یونیک‌ایندکس موتور تکرار واقعاً no-op (دو بار INSERT → یک ردیف)؛ نام دستهٔ تکراری برای همان کاربر رد می‌شود. آستانه‌های پوشش تیکت ۱۱ برای `src/lib/schemas` و `src/lib/id.ts` (۹۰/۸۵) و `src/lib/services` (۸۰/۸۰) فعال شد (گلوب categorization با تیکت ۲۱) — و اثرگذاری آستانه‌ها با تزریق یک آستانهٔ شکست‌خورده صحه‌گذاری شد. اسموک اسکیمای تیکت ۱۸ به فهرست هشت‌جدولی به‌روز شد.

**گام بعدی:** frontier = [تیکت ۲۰](20-jalali-module.md) (با شماره)؛ [تیکت ۲۱](21-categorization-engine-seed-lexicon.md) موازی آزاد؛ [تیکت ۲۲](22-category-expense-services-learning.md) تا رزول ۲۰ و ۲۱ گاز می‌خورد.
