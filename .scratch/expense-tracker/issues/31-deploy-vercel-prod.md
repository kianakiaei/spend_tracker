# 31 — دیپلوی Vercel + envهای prod + اولین استفادهٔ واقعی

Type: task
Status: open
Blocked by: 30, 16

## Question

روشن کردن prod با خروجی تیکت ۱۶ (URL دیتابیس، توکن never-expire، RESEND_API_KEY و فرستنده — همه از قبل در password manager/`.env` واقعی کاربر؛ **هیچ سکرتی در ریپو یا tracker نیست**):

- Vercel hobby؛ env vars طبق ۱۶: `TURSO_DATABASE_URL` (ریموت libsql://…)، `TURSO_AUTH_TOKEN`، `APP_URL`، سکرت‌های better-auth، `RESEND_API_KEY` + آدرس فرستنده.
- migration روی prod به‌شکل **دستی** `pnpm db:migrate` (الگوی امن‌تر تحقیق ۰۹ برای تک‌کاربر؛ گزینهٔ build = `drizzle-kit migrate && next build` در صورت نیاز).
- **تست دسترسی عملی از ایران** (عدم‌قطعیت صریح ۰۹): باز کردن اپ و کارکرد واقعی با دیتابیس ریموت — شکست → تصمیم محصولی تعویض بستر (پلن B: self-host `next start`/Docker یا فایل libSQL روی هاست اپ) با گریلینگ کاربر، نه تصمیم خاموش.
- **اولین ریست رمز واقعی** با Resend روی دامنهٔ کاربر → تحویل به inbox نه spam (قید ۰۸).
- `turso db export` اولیه به‌عنوان بکاپ پس از seed (PITR پلن Free فقط ۱ روز — تحقیق ۰۹).
- ثبت نتایج واقعی (بدون سکرت) در کامنت تیکت: URL اپ، ریجن منتخب، تاریخ بکاپ، نتیجهٔ تست دسترسی.

## Test plan

- قبولی = اپ زندهٔ قابل استفاده با ثبت/ویرایش واقعی خرج، API از بیرون با Bearer جواب می‌دهد (curl)، ریست رمز ایمیل واقعی، بکاپ گرفته‌شده.
