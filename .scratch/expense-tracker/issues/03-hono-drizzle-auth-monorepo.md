# 03 — اسکفولد مونوریپو: Hono + Drizzle + better-auth (+ انتخاب runtime)

Type: research
Status: open
Blocked by: —

## Question

تصمیم‌ها و بویلریت واقعیِ بک‌اند چیست؟

- انتخاب runtime: Bun (bun:sqlite) روی ویندوز امروز چقدر پخته است (dev/test/deploy)، یا Node + better-sqlite3؟ توصیه با دلیل.
- اسکفولد pnpm workspace: apps/api (Hono + Drizzle + drizzle-kit migrations + @hono/zod-validator)، apps/web، packages/shared (Zod)؛ تایپ‌سیف RPC با `hc` بدون کلاینت دستی — نسخه‌های فعلی و الگوی درست.
- یکپارچه‌سازی better-auth با آداپتور Hono روی SQLite/Drizzle: جداول auth، سشن، الگوی middleware.
- ملاحظات طراحی endpoint سینک (push/pull دسته‌ای با LWW بر اساس updatedAt) که ورودی تیکت «مدل داده و قرارداد سینک» باشد.
- مقصد یافته‌ها: `.scratch/expense-tracker/research/hono-drizzle-auth-monorepo.md`
