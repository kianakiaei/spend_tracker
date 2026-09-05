# 03 — اسکفولد مونوریپو: Hono + Drizzle + better-auth (+ انتخاب runtime)

Type: research
Status: resolved
Blocked by: —

## Question

تصمیم‌ها و بویلریت واقعیِ بک‌اند چیست؟

- انتخاب runtime: Bun (bun:sqlite) روی ویندوز امروز چقدر پخته است (dev/test/deploy)، یا Node + better-sqlite3؟ توصیه با دلیل.
- اسکفولد pnpm workspace: apps/api (Hono + Drizzle + drizzle-kit migrations + @hono/zod-validator)، apps/web، packages/shared (Zod)؛ تایپ‌سیف RPC با `hc` بدون کلاینت دستی — نسخه‌های فعلی و الگوی درست.
- یکپارچه‌سازی better-auth با آداپتور Hono روی SQLite/Drizzle: جداول auth، سشن، الگوی middleware.
- ملاحظات طراحی endpoint سینک (push/pull دسته‌ای با LWW بر اساس updatedAt) که ورودی تیکت «مدل داده و قرارداد سینک» باشد.
- مقصد یافته‌ها: `.scratch/expense-tracker/research/hono-drizzle-auth-monorepo.md`

## Answer

جزئیات کامل: [research/hono-drizzle-auth-monorepo.md](../research/hono-drizzle-auth-monorepo.md) (نسخه‌ها در 2026-09-06 از npm/مستندات رسمی چک شده‌اند).

- **Runtime: Node 24 LTS + better-sqlite3 13** (prebuilt برای win32-x64/arm64، بدون node-gyp). Bun 1.4.2 روی ویندوز برای dev/test واقعاً usable شده (استارتاپ 2.5x سریع‌تر، ARM64 نیتیو، bun:sqlite رسمی)، ولی «100% سازگار با Node نیست»، باگ‌های پراکنده node:http/worker_threads روی ویندوز باقی است و `bun:sqlite` کد را قفل می‌کند؛ مزیت کارایی Bun برای SQLite تک‌کاربره بی‌اثر است. آداپتور DB را در یک فایل isolate کنید تا مهاجرت بعدی به Bun (یا node:sqlite داخلی Node) فقط تغییر یک import باشد.
- **Stack فعلی:** hono 4.13.7، @hono/node-server 2.1.1، @hono/zod-validator 0.9.1، drizzle-orm 0.45.2، drizzle-kit 0.31.10، better-auth 1.7.2، zod 4.5.4. جریان migration: generate جداول auth با `npx @better-auth/cli@latest generate --output src/db/auth-schema.ts` → `drizzle-kit generate/migrate`.
- **RPC تایپ‌سیف:** `export type AppType = typeof app` از apps/api (با zValidator روی هر route) و مصرف با `hc<AppType>("/api", { credentials: "include" })` در apps/web. Gotchaها: tsconfig strict در هر دو سمت، نسخه hono یکسان در مونوریپو، `c.notFound()` استفاده نکنید (تایپ از بین می‌رود)، param/query همیشه string.
- **better-auth + Hono:** بدون آداپتور HTTP — `app.all("/api/auth/*", (c) => auth.handler(c.req.raw))`؛ دیتابیس با آداپتور `@better-auth/drizzle-adapter` (پکیج جدید از خط 1.5+) با `provider: "sqlite"`؛ session با `auth.api.getSession({ headers })` در یک `createMiddleware` از `hono/factory`؛ `trustedOrigins` + CORS با `credentials: true` و origin صریح.
- **سینک:** endpoint دسته‌ای `POST /api/sync` (push+pull در یک رفت‌وبرگشت)، cursor سمت‌سرور مونوتونیک، LWW با `updatedAt` سمت‌سرور + upsert شرطی (`WHERE excluded.updated_at > updated_at`)، tombstone (`deleted_at`)، op id سمت کلاینت (UUIDv7) برای idempotency، صفحه‌بندی pull. برای تیکت «مدل داده و قرارداد سینک»: ستون‌های استاندارد syncable از الان در Drizzle schema تعریف شود (`id/user_id/updated_at/deleted_at/created_at`)، مبلغ int (ریال)، `occurredAt` جدا از متادیتای سینک.
