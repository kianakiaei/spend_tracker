# 10 — استک Next.js تمام‌استک و الگوی API برای موبایل

Type: research
Status: claimed
Blocked by: —

## Question

جایگزین تحقیق ۰۳ (Hono + مونوریپو) که با چرخش استک باطل شد. اسکفولد و الگوهای درست Next.js تمام‌استک در 2026-09 چیست؟

- نسخهٔ فعلی Next.js (وضعیت App Router) و React؛ create-next-app + Tailwind + shadcn/ui + TypeScript strict روی pnpm تک‌اپ.
- بک‌اند داخل Next.js: Route Handlers به‌عنوان REST API نسخه‌دار (`/api/v1/...`) که هم وب و هم موبایل آینده مصرف کند — در برابر Server Actions؛ قاعدهٔ مرز (هر mutationای که موبایل لازم دارد باید Route Handler باشد؟)؛ اعتبارسنجی Zod بدون @hono/zod-validator.
- مصرف تایپ‌سیف API خودِ Next از کلاینت بدون `hc` هونو: الگوهای عملی (fetch تایپ‌شده، تولید OpenAPI از Zod، tRPC/oRPC — با توجه به اینکه موبایل REST خام می‌خواهد).
- Drizzle روی سرویس SQL انتخابی تیکت ۰۹: درایور درست برای محیط serverless + جریان drizzle-kit migrate در دیپلوی.
- better-auth روی Next.js (integration رسمی، نسخهٔ فعلی) در برابر Auth.js — وضعیت 2026؛ ورودی تیکت ۱۲ و تیکت auth.
- مقصد یافته‌ها: `.scratch/expense-tracker/research/nextjs-fullstack-api.md`
