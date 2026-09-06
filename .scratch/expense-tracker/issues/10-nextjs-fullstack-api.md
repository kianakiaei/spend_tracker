# 10 — استک Next.js تمام‌استک و الگوی API برای موبایل

Type: research
Status: resolved
Blocked by: —

## Question

جایگزین تحقیق ۰۳ (Hono + مونوریپو) که با چرخش استک باطل شد. اسکفولد و الگوهای درست Next.js تمام‌استک در 2026-09 چیست؟

- نسخهٔ فعلی Next.js (وضعیت App Router) و React؛ create-next-app + Tailwind + shadcn/ui + TypeScript strict روی pnpm تک‌اپ.
- بک‌اند داخل Next.js: Route Handlers به‌عنوان REST API نسخه‌دار (`/api/v1/...`) که هم وب و هم موبایل آینده مصرف کند — در برابر Server Actions؛ قاعدهٔ مرز (هر mutationای که موبایل لازم دارد باید Route Handler باشد؟)؛ اعتبارسنجی Zod بدون @hono/zod-validator.
- مصرف تایپ‌سیف API خودِ Next از کلاینت بدون `hc` هونو: الگوهای عملی (fetch تایپ‌شده، تولید OpenAPI از Zod، tRPC/oRPC — با توجه به اینکه موبایل REST خام می‌خواهد).
- اتصال Drizzle به Turso (libSQL — انتخاب کاربر، تیکت ۰۹ صاحب جزئیات درایور/migrate است): فقط الگوی مصرف از داخل Next.js (route handler/RSC، جلوگیری از اتصال چندگانه در dev/سرورلس) + جریان drizzle-kit migrate در دیپلوی.
- better-auth روی Next.js (integration رسمی، نسخهٔ فعلی) در برابر Auth.js — وضعیت 2026؛ ورودی تیکت ۱۲ و تیکت auth.
- مقصد یافته‌ها: `.scratch/expense-tracker/research/nextjs-fullstack-api.md`

## Answer

جزئیات کامل: [../research/nextjs-fullstack-api.md](../research/nextjs-fullstack-api.md) (نسخه‌ها در 2026-09-06 از npm و مستندات رسمی چک شده‌اند).

- **نسخه‌ها:** next **16.3.4** (App Router تنها روتر؛ Turbopack پیش‌فرض؛ Next 16 پایدار از 2025-10-22) + React **19.2.8** + TypeScript **7.0.2** (fallback: 5.9.3) + zod **4.5.4** + tailwind 4.3.3 + eslint 10 با `eslint-config-next` flat config. `pnpm create next-app@latest --src-dir` پیش‌فرض: TypeScript strict، Tailwind، ESLint، App Router، AGENTS.md. روی ویندوز باینری نیتیو SWC/Turbopack دارد — WSL لازم نیست.
- **مرز API:** همهٔ قرارداد API (هر endpointای که موبایل آینده لازم دارد = همهٔ CRUD دامنه) **Route Handler** است تحت `app/api/v1/...`؛ Server Action فقط شکرِ فرم وب که همان سرویس دامنه را صدا می‌زند؛ RSC هرگز Route Handler خود را fetch نمی‌کند (مستقیم `db`). اعتبارسنجی با helper نازک `parseJson`/`parseQuery` روی Zod 4 (`safeParse`)؛ خطا با قرارداد **problem+json (RFC 9457)**.
- **کلاینت تایپ‌سیف بدون `hc`:** الان **fetch wrapper + اشتراک Zod schema** (`z.infer`)؛ در آستانهٔ موبایل، **OpenAPI از همان schemaها با `zod-openapi` 6** → کلاینت با `openapi-typescript`. tRPC رد (نه REST خام، اکوسیستم OpenAPI آن مرده)؛ **oRPC 1.15** تنها زاپاس با OpenAPI نیتیو.
- **Auth: better-auth 1.7.3** — Auth.js v5 هنوز beta.32 است و پروژهٔ Auth.js از 2025-09-22 ضمیمهٔ Better Auth شده («پروژه‌های جدید با Better Auth شروع کنند»). ایمیل+رمز داخلی، سشن کوکی وب، آداپتور Drizzle هم‌نسخه (`provider: 'sqlite'`)، پلاگین `bearer()` برای موبایل. عدم‌قطعیت ثبت‌شده: مستندات آداپتور Turso را صریح نام نمی‌برد — smoke test اول پیاده‌سازی.
- مصرف Drizzle/Turso از داخل Next.js: singleton `@/db` مطابق §۳.۴ و migrate طبق §۴ تحقیق ۰۹. دیپلوی: پیش‌فرض Vercel hobby؛ self-host (`next start`/Docker) پلن B — ریسک دسترسی از ایران برای تست عملی به تیکت ۱۲.
