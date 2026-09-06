# پژوهش: استراتژی تست — Vitest 5 + RTL + Playwright روی libSQL لوکال

تاریخ پژوهش: 2026-09-06. نسخه‌ها مستقیماً از npm registry (`npm view`) استخراج شده‌اند؛ راهنمای رسمی Next.js (`nextjs.org/docs/app/guides/testing/vitest`، نسخهٔ سند 16.3.4، lastUpdated 2026-08-25)، مرجع config ویتست (`vitest.dev/config`) و readme رسمی `@libsql/client` هم در همین تاریخ واکشی شده‌اند. هیچ Docker یا دیتابیس شبکه‌ای در هیچ لایه‌ای لازم نیست — توسعه روی ویندوز و CI روی لینوکس هر دو با فایل libSQL کار می‌کنند.

## TL;DR — توصیه

1. **چهار لایهٔ تست با مسئولیت روشن** (نه «همه‌چیز با هر ابزار»):
   - **Unit دامنه (node env):** موتور دسته‌بندی (چک‌لیست تست فارسیِ سند تحقیق ۰۱)، ماژول `jalali-date.ts` (فهرست ادعاهای آزمودهٔ سند تحقیق ۰۴: مرز ماه، اسفند کبیسه، clamp)، منطق تولید الگوی تکرار (idempotency روی (الگو، monthKey)، روزِ چسبان به آخر ماه)، Zod schemaها و نرمال‌ساز. این‌جاست که «پوشش واقعی» معنا دارد — منطق خالص و ارزان.
   - **Component (jsdom + RTL):** فقط جریان‌های حیاتی کلاینت: فرم افزودن خرج با چیپ دستهٔ خودکارِ قابل‌تغییر، دِرِیل‌داون دسته، دکمهٔ غیرفعالِ حذف دستهٔ پُر + نشان تعداد، فرم الگوی تکرار.
   - **Integration دامنه+DB (node env + libSQL فایل‌موقت):** سرویس‌های دامنه روی `src/lib/services/*` در برابر دیتابیس واقعیِ موقت با همین migrationهای تولیدشده. Contract تست‌های Route Handler هم همین‌جا: handler به‌عنوان تابع معمولی با `Request` ساختگی، سشن mocked، ادعای خطای **problem+json** و قانون 409 «حذف دستهٔ پُر» (چون FK در libSQL پیش‌فرض خاموش است، این قانون **باید** در لایهٔ اپ و **باید** تست‌شده باشد — یافتهٔ تیکت ۰۹).
   - **E2E (Playwright 1.63):** پنج جریان: ثبت‌نام/ورود، افزودن خرج با پیشنهاد دسته، ناوبری ماه و دِرِیل دسته، الگوی تکرار تا تولدِ خرجِ ماه، رفتار انقضای سشن. reuse سشن با `storageState`.
2. **قید رسمی Next 16:** async Server Componentها با Vitest تست نمی‌شوند (سند رسمی صراحتاً E2E را توصیه می‌کند)؛ unit فقط برای sync server/client components. یعنی RSCهای داده‌خوان را با E2E می‌پوشانیم و سرویس‌های دامنه را با unit/integration — به همین دلیل تفکیک services از handlerها حیاتی است.
3. **DB تست:** per-run یک فایل libSQL موقت (`file:` با نام تصادفی در tmp) + `drizzle-orm/libsql/migrator` روی همان پوشهٔ migrationها — پاریتی schema با Turso از همین راه تضمین می‌شود؛ بدون شبکه، بدون مصرف سقف رایگان. گزینهٔ سریع‌تر: `:memory:` که readme رسمی `@libsql/client` رسماً پشتیبانی می‌کند (فقط اگر تست‌ها به inspect بین تست نیاز نداشته باشند).
4. **پوشش:** `@vitest/coverage-v8` با آستانهٔ **per-glob** (نه سراسری): `src/lib/**` ≥90% lines و ≥85% branches؛ `src/lib/services/**` ≥80% (DB interaction)؛ کامپوننت‌ها/صفحات بدون آستانه — پوشش‌شان را E2E می‌دهد. بویلرپلیت Next (`.next`، `next-env`، layout ها، `*.config.*`) exclude.
5. **CI:** GitHub Actions — PR: `vitest run --coverage` + Playwright روی `next start` بعد از build؛ main: همین + آرتیفکت coverage. Cache فروشگاه pnpm و مرورگرهای Playwright.

## 1. نسخه‌ها (npm، 2026-09-06)

| پکیج | نسخه | نقش | منبع |
|---|---|---|---|
| vitest | 5.0.0 | runner (node + jsdom با `projects`) | npm |
| @vitest/coverage-v8 | 5.0.0 | پوشش | npm |
| @vitejs/plugin-react | 6.1.1 | transform JSX در ویتست | npm |
| vite-tsconfig-paths | 6.1.1 | aliasهای tsconfig (سند رسمی Next آن را می‌گذارد) | npm |
| jsdom | 30.0.1 | env کامپوننت (انتخاب سند رسمی Next؛ happy-dom گزینهٔ سریع‌تر) | npm |
| @testing-library/react | 16.3.3 | RTL (سازگار React 19) | npm |
| @testing-library/dom | 10.4.1 | peer RTL 16 | npm |
| @testing-library/jest-dom | 7.0.1 | matcherهای DOM | npm |
| @testing-library/user-event | 14.6.7 | تعامل واقعی‌نما | npm |
| @playwright/test | 1.63.0 | E2E | npm |
| @libsql/client | 0.18.0 | فایل موقت/`:memory:` برای تست DB | npm readme |

## 2. Vitest در Next 16 — راه رسمی

راهنمای رسمی Next (16.3.4) برای unit testing فقط Vitest+RTL را مستند می‌کند (Jest از مسیر رسمی حذف شده) و setup آن همین است: `vitest` + `@vitejs/plugin-react` + `jsdom` + `@testing-library/react` + `@testing-library/dom` + `vite-tsconfig-paths`، با config ای که فقط `plugins: [tsconfigPaths(), react()]` و `environment: 'jsdom'` می‌گذارد. نکتهٔ صریح سند: «Vitest فعلاً async Server Componentها را ساپورت نمی‌کند؛ برای آن‌ها E2E».

ما دو env لازم داریم (دامنه/Integration روی node، کامپوننت روی jsdom) — API فعلی `test.projects` در خود root config است (مرجع vitest.dev/config؛ workspace-file قدیمی دیگر مسیر توصیه‌شده نیست):

```ts
// vitest.config.mts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/api/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/components/**/*.test.tsx'],
          setupFiles: ['./tests/setup.components.ts'],
        },
      },
    ],
  },
})
```

- تست‌های دامنه و API را **بیرون از `app/`** در `tests/` نگه می‌داریم (کلودِ تست کنار فایل هم مجاز است، ولی تفکیک env ایجاب می‌کند مسیرها جدا باشند).
- سرویس‌های دامنه نباید `next/*` import کنند تا در node env بدون شیم اجرا شوند — اگر مجبور شدیم، alias به نسخهٔ test در config.

## 3. Integration دامنه + DB با libSQL موقت

الگوی تیکت ۰۹ عیناً قابل‌اجراست و همین‌جا مهر می‌شود:

```ts
// tests/helpers/db.ts
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

export async function testDb() {
  const url = `file:${join(tmpdir(), `test-${randomUUID()}.db`)}` // یا ':memory:'
  const client = createClient({ url })
  const db = drizzle(client)
  await migrate(db, { migrationsFolder: './drizzle' })
  return { db, client }
}
```

- **پاریتی:** تست‌ها با همان فایل‌های SQL تولیدی `drizzle-kit generate` بالا می‌آیند که prod بالا می‌آید — هیچ dual-schema ای وجود ندارد.
- **FK خاموش:** در libSQL/SQLite `foreign_keys` پیش‌فرض خاموش است (یافتهٔ تیکت ۰۹)؛ تست integration باید دو حالت را اثبات کند: (الف) قانون دامنه «حذف دستهٔ دارای خرج» در سرویس 409/problem+json می‌دهد، (ب) اگر روزی pragma روشن شد هم رویه می‌شکند — پس قانون فقط و فقط در یک جا (سرویس) پیاده می‌شود.
- **Idempotency الگوی تکرار:** تست: دوبار اجرای تولیدِ یک ماه → دقیقاً یک خرج به‌ازای هر (الگو، monthKey)؛ روزِ ۳۱ جلالی در ماه ۳۰روزه → آخرِ ماه.
- `:memory:` به‌عنوان سوییچ سرعت در سند ثبت شد (readme رسمی)؛ پیش‌فرض ما فایل موقت است چون دیباگ پس از شکست (بازکردن فایل) راحت‌تر است.

## 4. Contract تست Route Handler (بدون سرور)

Route Handler ها توابع معمولی‌اند: `(req: Request, ctx) => Response`. تست مستقیمشان در node env:

```ts
const res = await DELETE(new Request('http://x/api/v1/categories/c1'), { params: Promise.resolve({ id: 'c1' }) })
expect(res.status).toBe(409)
expect(res.headers.get('content-type')).toContain('application/problem+json')
```

- سشن better-auth را با ماژول‌مکِ سمت test جابجا می‌کنیم (`vi.mock('@/lib/auth')` روی `auth.api.getSession`) — کمترین قلاب‌کاری؛ wiring واقعی auth را E2E می‌پوشاند.
- ادعاهای هر handler: موفق (status/body)، Zod-invalid → 400 با member `errors` در problem+json، 401 بدون سشن، 409 قانون دسته.
- اگر handler چیزی جز «parse → صدا زدن سرویس → map خطا» داشت، بوی坏事 است؛ این تست‌ها همان لایه‌بندی را مجبور می‌کنند.

## 5. Playwright 1.63 — پنج جریان + سشن reuse

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'pnpm build && pnpm start', // در CI؛ لوکال: 'pnpm dev' + reuseExistingServer: true
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
```

- **سشن reuse:** `globalSetup` با `POST /api/auth/sign-in/email` (endpoint استاندارد better-auth email-password) لاگین می‌کند، `Set-Cookie` را در `storageState` ذخیره می‌کند و بقیهٔ تست‌ها با `use: { storageState }` وارد می‌شوند — UI تست ورود فقط در یک تستِ اختصاصی.
- پنج جریان E2E (حداقلِ کافی): ثبت‌نام/ورود؛ افزودن خرج + پیشنهاد خودکار قابل‌تغییر؛ ناوبری ماه جلالی و بازکردن دِرِیل دسته؛ ساختن الگوی تکرار و دیدن خرجِ تولیدشده در ماه؛ منقضی‌شدن سشن (پاک‌کردن کوکی) → رفتار صفحه.
- عدم‌قطعیت ثبت‌شدهٔ تیکت ۱۰ (ترکیب better-auth+Turso) را اولین E2E با دیتابیس dev لوکال می‌شکند — قبل از هر چیز دیگر.

## 6. پوشش — آستانهٔ per-glob واقع‌بینانه

```ts
// داخل projects[0] (node):
coverage: {
  provider: 'v8',
  include: ['src/lib/**'],
  thresholds: {
    'src/lib/categorization/**': { lines: 90, branches: 85 },
    'src/lib/jalali/**':        { lines: 90, branches: 85 },
    'src/lib/recurring/**':     { lines: 90, branches: 85 },
    'src/lib/services/**':      { lines: 80, branches: 75 },
  },
  exclude: ['src/lib/**/*.d.ts'],
}
```

- چرا سراسری نه: کامپوننت‌های کلاینت و صفحات با RTL جزئی + E2E پوشش می‌شوند و threshold سراسری یا دروغ می‌شود یا تستِ بی‌ارزش تولید می‌کند. آستانهٔ سخت فقط جایی است که منطق خالص است.
- دامنهٔ «ماژول‌های دامنه» عمداً با فهرست glob نگه داشته می‌شود تا ماژول تازه به‌محض تولد به فهرست اضافه شود — یک review gate آگاهانه، نه آزمون ناگهانی CI.

## 7. CI (GitHub Actions)

```yaml
name: ci
on: [pull_request, push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run --coverage --project node
      - run: pnpm vitest run --project jsdom
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm playwright test
      - if: github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@v4
        with: { name: coverage, path: coverage/ }
```

- بدون service container (Postgres/Docker) — مزیت مستقیم مسیر libSQL: CI سبک و سریع.
- Node 24 (هم‌راستا با runtime تصمیم قبلی مونوریپو که در Next 16 هم معتبر است؛ LTS).

## 8. چیزی که تست نمی‌کنیم

- **async RSC با unit** (قید رسمی) — E2E.
- Internals خود Next (routing/rendering) و SQL تولیدی drizzle-kit — «کد دیگران»؛ مرز ما: سرویس‌ها و handlerها.
- UI glue بدون منطق (استایل/چیدمان) — frontend-design و E2E می‌پوشانند.
- Snapshot تست‌های شکننده — ممنوع؛ ادعاها role-based (RTL) و HTTP-level.

## 9. ریسک‌ها و عدم‌قطعیت‌ها

1. **vitest 5.0.0 خیلی تازه است** — اگر با Next 16/Turbopack friction دیدیم، سقوط به آخرین 4.x ارزان است (API `projects` در 3+ یکسان است)؛ در سند ثبت شد نه تصمیم.
2. **TS 7 native (tsgo):** ویتست transform خودش را دارد (وابسته به tsc نیست)؛ اگر typecheck فرق کرد، fallback 5.9.3 تصمیم تیکت ۱۰ است.
3. **بودجهٔ E2E:** پنج جریان سقف MVP است؛ تست ورودِ بهتر-auth واقعی روی Turso واقعی نه — همهٔ E2E با دیتابیس dev لوکال (فایل) اجرا می‌شود تا سقف رایگان و شبکه در بازی نباشد.
4. فایل `playwright.config`/CI بالا **sketch** است — مقادیر دقیق (timeout، retries، workers) موقع اسکفولد تنظیم می‌شود.
