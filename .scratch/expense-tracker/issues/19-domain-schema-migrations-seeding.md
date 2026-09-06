# 19 — اسکیمای دامنه + مهاجرت افزایشی + seed دسته‌های سیستمی

Type: task
Status: open
Blocked by: 18

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
