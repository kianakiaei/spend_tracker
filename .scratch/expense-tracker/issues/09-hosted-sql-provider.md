# 09 — راه‌اندازی Turso (libSQL) + Drizzle در Next.js

Type: research
Status: claimed
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
