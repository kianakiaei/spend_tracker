# 11 — استراتژی تست با پوشش واقعی

Type: research
Status: open
Blocked by: 09

## Question

«تست‌ها درست و با پوشش» — اولویت صریح کاربر. طرح تست عملی برای Next.js تمام‌استک با دیتابیس SQL هاست‌شده (خروجی تیکت ۰۹) چیست؟

- Vitest با Next.js (محدودیت‌های App Router/RSC)، RTL + jsdom برای کامپوننت‌های حیاتی، Playwright برای E2E (ورود، ثبت خرج، دسته‌بندی خودکار، الگوی تکرار) با config درست (`webServer`).
- تست integration دیتابیس در برابر چه؟ (فایل libSQL لوکال / `turso dev` / دیتابیس staging واقعی روی Turso) — با توجه به ویندوزِ توسعه‌دهنده و پارتی schema لوکال-ریموت (خروجی تیکت ۰۹).
- تست موتور دسته‌بندی (تحقیق ۰۱) به‌عنوان واحد خالص با چک‌لیست تست فارسی موجود در سند پژوهش.
- پوشش: ابزار (v8 coverage در Vitest)، آستانهٔ پیشنهادی واقع‌بینانه (ماژول‌های دامنه در برابر UI)، CI با GitHub Actions.
- مقصد یافته‌ها: `.scratch/expense-tracker/research/testing-strategy.md`
