# 11 — استراتژی تست با پوشش واقعی

Type: research
Status: resolved
Blocked by: 09

## Question

«تست‌ها درست و با پوشش» — اولویت صریح کاربر. طرح تست عملی برای Next.js تمام‌استک با دیتابیس SQL هاست‌شده (خروجی تیکت ۰۹) چیست؟

- Vitest با Next.js (محدودیت‌های App Router/RSC)، RTL + jsdom برای کامپوننت‌های حیاتی، Playwright برای E2E (ورود، ثبت خرج، دسته‌بندی خودکار، الگوی تکرار) با config درست (`webServer`).
- تست integration دیتابیس در برابر چه؟ (فایل libSQL لوکال / `turso dev` / دیتابیس staging واقعی روی Turso) — با توجه به ویندوزِ توسعه‌دهنده و پارتی schema لوکال-ریموت (خروجی تیکت ۰۹).
- تست موتور دسته‌بندی (تحقیق ۰۱) به‌عنوان واحد خالص با چک‌لیست تست فارسی موجود در سند پژوهش.
- پوشش: ابزار (v8 coverage در Vitest)، آستانهٔ پیشنهادی واقع‌بینانه (ماژول‌های دامنه در برابر UI)، CI با GitHub Actions.
- مقصد یافته‌ها: `.scratch/expense-tracker/research/testing-strategy.md`

## Answer

چهار لایهٔ تست با مسئولیت روشن: **unit دامنه** (node env — موتور دسته‌بندی با چک‌لیست فارسی تحقیق ۰۱، `jalali-date.ts` با ادعاهای تحقیق ۰۴، تولید الگوی تکرار idempotent، Zod)، **component** (jsdom + RTL فقط برای جریان‌های حیاتی کلاینت)، **integration دامنه+DB** (سرویس‌ها + Route Handler به‌عنوان تابع معمولی با `Request` ساختگی و سشن mocked، روی فایل libSQL موقت + `drizzle-orm/libsql/migrator` — پاریتی schema با prod، گزینهٔ `:memory:` رسماً پشتیبانی می‌شود)، **E2E با Playwright 1.63** (پنج جریان: ورود، افزودن خرج، ناوبری ماه، الگوی تکرار، انقضای سشن؛ reuse سشن با storageState از `POST /api/auth/sign-in/email`).

قید رسمی Next 16: **async Server Component ها با Vitest تست نمی‌شوند** → RSCها فقط E2E؛ به همین دلیل سرویس‌های دامنه باید از handlerها تفکیک شوند. دو env با `test.projects` (API فعلی Vitest 5) در یک config. پوشش با `@vitest/coverage-v8` و آستانهٔ **per-glob نه سراسری**: `src/lib/{categorization,jalali,recurring} ≥90% lines / ≥85% branches`، `services ≥80%`، UI بدون آستانه (E2E می‌پوشاند). FK خاموشِ libSQL یعنی قانون «حذف دستهٔ پُر» باید در سرویس و با تست 409 اثبات شود. CI = GitHub Actions بدون Docker/service container (مزیت مسیر libSQL)؛ vitest 5.0.0 تازه است و سقوط به 4.x مسیر عقب‌نشینی ثبت‌شده است.

جزئیات و کانفیگ‌ها: [research/testing-strategy.md](../research/testing-strategy.md)
