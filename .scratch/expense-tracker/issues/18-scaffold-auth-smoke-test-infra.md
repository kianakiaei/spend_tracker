# 18 — اسکفولد اپ + smoke-test better-auth روی libSQL لوکال + زیرساخت تست و CI

Type: task
Status: resolved
Blocked by: —
Assignee: IDEHAL (agent session, 2026-09-06)

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

## Answer

**تمام شد (2026-09-06) — عدم‌قطعیت ثبت‌شدهٔ تیکت ۱۲ (ترکیب better-auth + libSQL) با smoke واقعی بسته شد؛ سبز کامل: lint ✓ / tsc ✓ / vitest 7/7 (دو project) ✓ / e2e 2/2 ✓ / build ✓.** کامیت‌ها: `0465c5a` (اسکفولد) → `3d0b7b7` (db+auth+migration) → `d71bd09` (vitest+smoke) → `26031f8` (playwright+scripts+CI) → `67e31a1` (سکرت) → `114f61d` (اصلاحات code-review).

**نسخه‌ها (npm، روز اجرا):** next **16.3.4**، react **19.2.8**، zod **4.5.4**، tailwind **4.3.3**، eslint flat با eslint-config-next (eslint 9.39) — همه طبق تیکت ۱۰. drizzle-orm **0.45.2** + @libsql/client **0.18.0** + drizzle-kit **0.31.10** + better-auth **1.7.3** + vitest **5.0.0** (جای‌گریزی به 4.x لازم نشد) + @vitest/coverage-v8 5.0.0 + playwright **1.63.0**. **انحراف واحد: TypeScript 7.0.2 → fallback ثبت‌شدهٔ 5.9.3** — 7.0.2 نصب شد و `tsc --noEmit` پاس می‌کرد، ولی typescript-eslint 8.69.0 (از طریق eslint-config-next) صراحتاً TS 7.0 را رد می‌کند (`pnpm lint` با ERR می‌شکند؛ ردیابی: typescript-eslint#10940 برای TS ≥7.1)؛ همان‌طور که تیکت ۱۰ ثبت کرده بود عقب‌نشینی شد و دقیق پین شد (`"typescript": "5.9.3"`).

**Smoke هدف تیکت — هر سه مسیر سبز** (`tests/integration/auth-smoke.test.ts`): `auth.handler` با `Request` واقعی روی فایل libSQL موقتِ per-run + `drizzle-orm/libsql/migrator` روی همان migrationهای کامیت‌شده. ثبت‌نام → 200 + کوکی `better-auth.session_token` (httpOnly/SameSite=Lax)؛ `get-session` با کوکی → 200 با کاربر؛ ورود → کوکی + هدر `set-auth-token` و `get-session` با `Authorization: Bearer` → 200 (مسیر موبایل working است)؛ بدون اعتبار → `null`. نکتهٔ شکل پاسخ: ثبت‌نام/ورود `{ token, user: {…} }` برمی‌گردانند (نه کاربرِ تخت). **ناسازگاری یافته‌شده و کمینه‌ترین رفع:** better-auth بدون `BETTER_AUTH_SECRET` در حالت production می‌شکند (e2e که `next start` می‌زند 500 می‌داد) — سکرت dev در `.env` گیت‌ایگنوردشده، مستند در `.env.example`، و در CI یک مقدار ساختگیِ صریح در سطح job؛ هشدار baseURL هم با `BETTER_AUTH_URL` لوکال خفه شد (prod: مشتق از request — تیکت ۳۱ موقع دیپلوی مقدار می‌گذارد). هشدار «Base URL is not set» در build بی‌اثر است.

**بقیهٔ تحویل:** `src/db/index.ts` singleton ضد-HMR (الگوی §۳.۴ تحقیق ۰۹ + خطای صریح اگر env نباشد)؛ auth tables (user/session/account/verification) در `src/db/schema.ts` با آداپتور Drizzle `provider: 'sqlite'`، ایمیل+رمز، `bearer()` و `nextCookies()` آخرین پلاگین؛ سشن ۷روزهٔ لغزان طبق تیکت ۰۸ (`expiresIn` 7d / `updateAge` 1d)؛ mount در `src/app/api/auth/[...all]/route.ts`؛ اولین migration `drizzle/0000_*.sql` با `dialect: 'turso'` روی فایل لوکال (تأیید تحقیق ۰۹ عیناً برقرار) و `pnpm db:migrate` روی `local.db` اجرا شد. vitest.config.mts با دو project — node: `tests/unit` + `tests/integration`، jsdom: `tests/components` — و تست دودی در هر سه؛ آستانه‌های پوشش عمداً هنوز نیست (تیکت‌های ۱۹–۲۴، بستن در ۳۰). Playwright: config با `webServer: pnpm build && pnpm start` + دو ادعای دودی (صفحهٔ ریشه + `/api/auth/ok`)؛ پنج جریان واقعی E2E با تیکت ۳۰ است. CI: `.github/workflows/ci.yml` — install → lint → **typecheck** → test → e2e (با playwright install chromium) → build، بدون service container، node 24 + pnpm action. اسکریپت‌ها: نُه اسکریپتِ درخواستی + `typecheck` و `test:coverage` (additive). AGENTS.md و CONTEXT.md بازنویسی نشدند — فقط بلاک خودکارِ `nextjs-agent-rules` (که `next dev` دوباره می‌نویسد و خودش به کامیت توصیه می‌کند) به AGENTS.md اضافه و `CLAUDE.md` (= اشاره‌گر `@AGENTS.md`) ساخته شد؛ هر دو خروجی ابزار create-next-app/next بودند، محتوای دست‌نویس دست‌نخورده. `.gitignore`: `next-env.d.ts`، `.vercel`، آرتیفکت‌های Playwright، و سایدکارفایل‌های libSQL (`*.db-journal/-wal/-shm`) اضافه شد؛ `.env*` از قبل پوشش داشت.

**یادداشت ویندوز/محیط:** pnpm با `npm i -g` نصب شد (corepack روی Program Files حقوق نوشتن نداشت)؛ `packageManager: pnpm@12.3.4` ثبت شد؛ در `pnpm-workspace.yaml` بیلدِ esbuild (وابستگی vitest/drizzle-kit) با `allowBuilds: esbuild: true` مجاز شد؛ مرورگر Chromium برای Playwright روی ماشین dev نصب شد.

**گام بعدی:** تیکت ۱۹ (اسکیمای دامنه + seed) با «اول با شماره»؛ ۲۰ (جلالی) و ۲۱ (موتور دسته‌بندی) موازی آزادند؛ تیکت ۱۶ (HITL) همچنان مستقل.
