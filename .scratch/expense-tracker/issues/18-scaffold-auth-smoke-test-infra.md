# 18 — اسکفولد اپ + smoke-test better-auth روی libSQL لوکال + زیرساخت تست و CI

Type: task
Status: open
Blocked by: —

## Question

ساخت اسکفولد تک‌اپ Next.js و بستن **عدم‌قطعیت ثبت‌شدهٔ تیکت ۱۲** (ترکیب better-auth + libSQL) با یک smoke-test واقعی، به‌همراه زیرساخت تست و CI طبق تیکت ۱۱:

- اسکفولد: `pnpm create next-app@latest --src-dir` — نسخه‌های تیکت ۱۰ (next 16.3.4، React 19.2.8، TypeScript 7.0.2 با fallback ثبت‌شدهٔ 5.9.3، zod 4.5.4، Tailwind 4.3.3، eslint flat با `eslint-config-next`)؛ اگر create-next-app نسخهٔ تازه‌تر داد همان و در کامیت ثبت شود. TS سخت‌گیرانه بدون any.
- DB: `drizzle-orm/libsql` 0.45.2 + `@libsql/client` 0.18.0 + `drizzle-kit 0.31.10`؛ `src/db/index.ts` singleton ضد-HMR (الگوی §۳.۴ تحقیق ۰۹)؛ `.env` با `TURSO_DATABASE_URL=file:./local.db` بدون توکن (dev هرگز به Turso نمی‌زند — تأکید صریح تیکت ۱۲)؛ `.env*` و `local.db` در `.gitignore`.
- better-auth 1.7.3: آداپتور Drizzle (`provider: 'sqlite'`)، ایمیل+رمز، پلاگین `bearer()`، `nextCookies()` آخرین پلاگین آرایه؛ mount در `src/app/api/auth/[...all]/route.ts`؛ جدول‌های auth (user/session/account/verification) در `src/db/schema.ts` و **اولین migration** با `drizzle-kit generate` (config با `dialect: 'turso'` — برای فایل لوکال هم کار می‌کند، تأیید تحقیق ۰۹)؛ سیم‌کشی `drizzle-orm/libsql/migrator` برای تست.
- **Smoke-test هدف تیکت:** ثبت‌نام و ورود واقعی روی libSQL لوکال — `auth.handler` با `Request` واقعی صدا زده شود: sign-up → کوکی سشن ست شود؛ sign-in → کوکی + هدر `set-auth-token` (مسیر bearer موبایل)؛ `getSession` با هر دو مسیر (کوکی و `Authorization: Bearer`) جواب دهد. ناسازگاری = مستندسازی در کامنت تیکت + کمینه‌ترین رفع.
- زیرساخت تست: Vitest 5.0.0 (fallback ثبت‌شدهٔ 4.x) با دو projects (`test.projects`: node + jsdom)؛ `@vitest/coverage-v8` نصب — آستانه‌های per-glob **بعداً و هم‌گام با هر ماژول** اضافه می‌شوند (بستن نهایی: تیکت ۳۰)؛ Playwright 1.63 با config و `webServer` + یک spec دودی؛ integration روی فایل libSQL موقت per-run + migrator (بدون شبکه).
- CI: GitHub Actions بدون service container — pnpm install → lint → test → e2e → build.
- اسکریپت‌ها: `dev/build/start/lint/test/test:watch/e2e/db:generate/db:migrate`. ریشهٔ ریپو `AGENTS.md` و `CONTEXT.md` موجودند — بازنویسی نشوند.

## Test plan

- integration (فایل temp + migrator): smoke ثبت‌نام/ورود/bearer/getSession — همین اولین تست integration است و عدم‌قطعیت تیکت ۱۲ را می‌بندد.
- یک تست دودی در هر project (node و jsdom) تا کانفیگ دو-env اثبات شود؛ spec دودی Playwright که سرور بالا می‌آید.
- CI سبز روی همهٔ مرحله‌ها.
