# پژوهش: Next.js تمام‌استک — REST API نسخه‌دار، کلاینت تایپ‌سیف و Auth (بدون Hono)

تاریخ پژوهش: 2026-09-06. نسخه‌ها مستقیماً از npm registry (`npm view`)، مستندات رسمی nextjs.org (نسخهٔ سند: 16.3.4)، better-auth.com، authjs.dev، orpc.dev و سورس قالب `create-next-app` در GitHub استخراج شده‌اند. این پژوهش جانشین تحقیق ۰۳ (Hono + مونوریپو + better-sqlite3) است که با چرخش استک باطل شد؛ زنده‌های آن (zod 4.5.4، better-auth، ایدهٔ لایهٔ DB ایزوله) اینجا ادامه می‌یابند.

## TL;DR — توصیه

1. **اسکفولد: `pnpm create next-app@latest`** با پرچم‌های پیش‌فرض + `--src-dir`. یعنی Next.js **16.3.4** (App Router، Turbopack پیش‌فرض و پایدار)، React **19.2.8**، TypeScript با `"strict": true` (پیش‌فرض قالب)، Tailwind (خط v4 — جدیدترین 4.3.3)، ESLint 10 با flat config از `eslint-config-next`. TypeScript 7.0.2 جدیدترین است و Next 16 رسماً از آن برای `next build` پشتیبانی می‌کند؛ اگر وابستگی‌ای با TS 7 مشکل داشت، 5.9.3 آخرین خط 5.x است.
2. **REST API نسخه‌دار = Route Handlers تحت `app/api/v1/...`.** قاعدهٔ مرز: **«هر endpointای که بخشی از قرارداد API اپ است — یعنی هر کاری که موبایل آینده ممکن است لازم داشته باشد — Route Handler است. Server Action فقط شکرِ ارگونومیک فرم وب است و باید همان تابع سرویس دامنه را صدا بزند؛ هیچ منطق دامنه‌ای فقط داخل Action تعریف نمی‌شود.»** RSC هرگز از Route Handler خود fetch نمی‌کند — مستقیم از `db`/سرویس می‌خواند (توصیهٔ صریح مستندات).
3. **اعتبارسنجی با Zod 4.5.4 و یک helper نازک** (`parseJson`/`parseQuery` با `safeParse`) — جایگزین `@hono/zod-validator`. خطاها با قرارداد استاندارد **problem+json (RFC 9457)** برگردانده شود تا وب و موبایل یک قرارداد خطا داشته باشند.
4. **کلاینت تایپ‌سیف بدون `hc`:** الان **fetch wrapper نازک + اشتراک schemaهای Zod** (نوع‌ها با `z.infer`، اعتبارسنجی دوباره در کلاینت). برای موبایل و مستندسازی، **OpenAPI تولیدشده از همان schemaها با `zod-openapi` 6** و کلاینت تایپ‌شده با `openapi-typescript`. **tRPC رد می‌شود** (پروتکل اختصاصی، نه REST خام؛ اکوسیستم OpenAPI آن هم رها شده). **oRPC 1.15** تنها RPC تایپ‌سیفی است که OpenAPI نیتیو دارد — زاپاس آینده، نه انتخاب الان.
5. **Auth: better-auth 1.7.3.** Auth.js v5 بعد از ۳ سال هنوز `beta.32` است و کل پروژهٔ Auth.js از 2025-09-22 **ضمیمهٔ Better Auth شده** و خودش «پروژه‌های جدید با Better Auth شروع کنند» می‌گوید. better-auth یکپارچگی رسمی Next.js (تا 16)، آداپتور Drizzle هم‌نسخه، ورود ایمیل+رمز داخلی و پلاگین `bearer()` برای کلاینت‌های بدون کوکی (موبایل آینده) دارد.
6. **مصرف Drizzle/Turso از داخل Next.js:** یک فولدر `src/db` با singleton جهانی برای HMR — جزئیات کامل (درایور، per-context config، migrate در دیپلوی) در تحقیق ۰۹ (§۳.۴ و §۴) است و اینجا تکرار نمی‌شود.
7. **دیپلوی:** پیش‌فرض عملی Vercel (پلن hobby)؛ self-host با `next start`/Docker پلن B اگر دسترسی مشکل شد. جزئیات deeper با معماری (تیکت ۱۲).

## 1. نسخه‌ها و وضعیت اسکفولد (2026-09-06)

| پکیج | نسخه | نکات | منبع |
|---|---|---|---|
| next | 16.3.4 (2026-09-05) | Next 16 پایدار از **2025-10-22**؛ canary: 16.4.0-canary.19؛ حداقل Node **20.9** و TS **5.1** | [npm](https://www.npmjs.com/package/next) |
| react / react-dom | 19.2.8 (2026-07-21) | App Router Next 16 روی React 19.2 می‌دود | [npm](https://www.npmjs.com/package/react) |
| typescript | 7.0.2 (2026-09-05) | نسخهٔ بومی (کامپایلر Go)؛ Next 16 برای build از CLI محلی `tsc` استفاده می‌کند و TS 7 را مستند کرده. خط ۵ به‌عنوان fallback: 5.9.3 | [npm](https://www.npmjs.com/package/typescript), [docs TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript) |
| tailwindcss | 4.3.3 (2026-08-31) | خط v4؛ create-next-app به‌صورت پیش‌فرض Tailwind می‌گذارد (نسخهٔ دقیق pin در قالب هاردکد نیست — latest نصب می‌شود) | [npm](https://www.npmjs.com/package/tailwindcss), [docs create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app) |
| eslint / eslint-config-next | 10.10.0 / 16.3.4 | Next 16 دستور `next lint` را حذف کرد؛ قالب new یک `eslint.config.mjs` flat config با `core-web-vitals` + `typescript` preset می‌سازد (از سورس قالب تأیید شد) | [npm](https://www.npmjs.com/package/eslint-config-next) |
| zod | 4.5.4 (2026-08-29) | همان زندهٔ تیکت ۰۳؛ better-auth 1.7.3 هم خودش `zod ^4.5.4` dependency دارد | [npm](https://www.npmjs.com/package/zod) |
| better-auth | 1.7.3 (2026-09-06) | + `@better-auth/drizzle-adapter` 1.7.3 (هم‌نسخه) و `@better-auth/cli` 1.4.21. peerDeps شامل `next ^14 || ^15 || ^16`، `react 18/19`، `drizzle-orm ^0.45.2` | [npm](https://www.npmjs.com/package/better-auth) |
| next-auth | latest: 4.24.15 / beta: 5.0.0-beta.32 (2026-07-20) | **v5 بعد از ~۳ سال هنوز beta است**؛ `@auth/core` 0.41.3؛ `@auth/drizzle-adapter` 1.11.3 | [npm](https://www.npmjs.com/package/next-auth) |
| @trpc/server | 11.18.0 (2026-09-03) | فعال، ولی کلاینتش REST خام نیست؛ پکیج OpenAPI آن (`trpc-openapi` 1.2.0) از 2024-11 آپدیت نشده | [npm](https://www.npmjs.com/package/@trpc/server) |
| @orpc/server | 1.15.0 (2026-09-05) | RPC تایپ‌سیف با OpenAPI Handler نیتیو و integration رسمی Next.js | [npm](https://www.npmjs.com/package/@orpc/server), [orpc.dev](https://orpc.dev) |
| zod-openapi / @asteasolutions/zod-to-openapi | 6.0.2 / 9.1.0 | تولید OpenAPI از schemaهای Zod (zod-openapi فعال‌تر؛ هر دو قابل استفاده) | [npm](https://www.npmjs.com/package/zod-openapi) |
| openapi-typescript | 7.13.0 (2026-06-15) | تولید کلاینت/تایپ از spec OpenAPI (جفت با openapi-fetch) | [npm](https://www.npmjs.com/package/openapi-typescript) |
| drizzle-orm / @libsql/client | 0.45.2 / 0.18.0 | فقط برای پیوستگی با تحقیق ۰۹ — جزئیات آنجا | [npm](https://www.npmjs.com/package/drizzle-orm) |

### وضعیت Next.js 16 و App Router (سپتامبر 2026)

App Router دیگر «نسل جدید» نیست — تنها روتر فعال Next 16 و مبنای همهٔ مستندات است. نکات کلیدی Next 16 از [بیانیهٔ رسمی انتشار](https://nextjs.org/blog/next-16):

- **Turbopack پایدار و باندلر پیش‌فرض** همهٔ اپ‌های جدید (build تا ۲-۵× سریع‌تر، Fast Refresh تا ۱۰×). خروج با `--webpack` فقط برای سازگاری.
- **`proxy.ts` جانشین `middleware.ts`** (مرز شبکهٔ صریح، runtime Node.js)؛ `middleware.ts` deprecated.
- **Cache Components** (`"use cache"`) مدل کش جدید و کاملاً opt-in — «همهٔ کد داینامیک به‌طور پیش‌فرض در زمان درخواست اجرا می‌شود»؛ برای اپ دامنه‌محور ما یعنی رفتار «بدون کشِ ضمنیِ شگفت‌آور».
- Breaking changes مهم برای ما: `params` و `cookies()`/`headers()` همیشه `await` می‌گیرند؛ `revalidateTag` امضای جدید؛ حذف `next lint`.
- type helperهای سراسری تولیدی: `PageProps`، `LayoutProps` و **`RouteContext<'/users/[id]'>`** برای paramهای تایپ‌شدهٔ Route Handler (تولید با `next dev`/`next build`/`next typegen`).

### create-next-app امروز (ویندوز-دوستانه)

از [مستندات create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app) (نسخهٔ سند 16.3.4) و [سورس قالب](https://github.com/vercel/next.js/tree/canary/packages/create-next-app/templates):

- پیش‌فرض‌ها: TypeScript، ESLint، Tailwind CSS، App Router، Turbopack، **AGENTS.md** (!)، alias `@/*`. پرچم `--api` فقط-Route-Handler اسکفولد می‌کند (برای ما لازم نیست، ولی نشان می‌دهد الگوی API مستقیم مسیر رسمی است). با `--use-pnpm` روی pnpm می‌سازد.
- `tsconfig.json` قالب `"strict": true` دارد (از سورس قالب در canary تأیید شد — الزام «strict بدون any» کاربر از لحظهٔ صفر برقرار است).
- **ویندوز:** باینری SWC/Turbopack نیتیو ویندوز (`@next/swc-win32-x64-msvc` 16.3.4) در npm منتشر می‌شود؛ WSL لازم نیست. با انتخاب Node 24 از تیکت ۰۳ (≥ حداقل 20.9) و pnpm، کل حلقهٔ dev روی ویندوز بومی است. Next 16 همچنین lockfile داخلی دارد که دو `next dev` موازی روی یک پروژه را قفل می‌کند (برای dev چندشاخه‌ای باید حواس بود).

## 2. بک‌اند داخل Next.js: Route Handlers به‌عنوان `/api/v1`

### آناتومی و نسخه‌دار کردن

Route Handler = فایل `route.ts` با export های `GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS` ([مرجع route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route)). «نسخه‌دار بودن» صرفاً ساختار فولدر است:

```
src/app/api/v1/
  expenses/route.ts            GET (لیست), POST (ایجاد)
  expenses/[id]/route.ts       GET, PATCH, DELETE   ← ctx: RouteContext<'/api/v1/expenses/[id]'>
  categories/route.ts          GET, POST
  openapi.json/route.ts        GET (spec — بخش ۴)
  auth/[...all]/route.ts       better-auth (بخش ۵)
```

- `params` یک `Promise` است و با `RouteContext` تایپ می‌شود؛ runtime پیش‌فرض **nodejs** است (برای @libsql/client و better-auth درست همان چیزی که لازم است).
- **کش پیش‌فرض نیست:** از v15 به بعد GET های Route Handler به‌طور پیش‌فرض dynamic اند — برای API قراردادی همین می‌خواهیم؛ هرجا کش خواستیم صریحاً (`Cache-Control` یا segment config) اعلام می‌کنیم.
- برای نسخه‌های آینده (`/api/v2` یا deprecation مسیرهای v1)، `proxy.ts` جای قانونی redirect/rewrite است — بدون دست زدن به handlerها.
- CORS برای موبایل نیتیو اساساً موضوعیت ندارد (CORS مرورگری است)؛ برای استفادهٔ وب از دامنهٔ دیگر، راه رسمی هدرهای Web API یا `proxy` است.

### قاعدهٔ مرز Server Actions در برابر Route Handlers

مستندات رسمی ([راهنمای Backend-for-Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) و [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)) این دو را این‌طور جدا می‌کند:

- Route Handler: **«نقطهٔ پایانی HTTP عمومی. هر کلاینتی می‌تواند به آن دسترسی داشته باشد»** — webhook، API خارجی، هر content-type.
- Server Action: **«هدف اصلی‌اش mutate کردن داده از کلاینت فرانتِ شماست»**؛ فقط با `POST` پروتکل React صدا زده می‌شود؛ با `direct POST` هم مستقیماً قابل دسترسی است (پس باز هم authz لازم دارد!)؛ و **صف‌بندی/ترتیبی** dispatch می‌شود (برای fetch موازی مناسب نیست).

پس قاعدهٔ عملی این اپ:

> **قرارداد API = Route Handler.** هر CRUD دامنه (خرج، دسته، الگو) و هر endpointای که موبایل آینده مصرف می‌کند، از روز اول Route Handler تحت `/api/v1` است، با auth یکسان، اعتبارسنجی Zod و خطای problem+json. وب هم از همان `/api/v1` مصرف می‌کند (fetch wrapper تایپ‌شده، بخش ۴).
> **Server Action = بهینه‌سازی UX وب** (single-roundtrip، `updateTag`/`refresh`/`redirect`، progressive enhancement فرم‌ها). اگر استفاده شد، بدنش باید یک خط صدا زدن سرویس دامنه باشد که Route Handler هم از همان استفاده می‌کند — منطقِ فقط-اکشن یعنی باگ قرارداد API.
> **RSC هرگز Route Handler خودش را fetch نمی‌کند** (مستندات: گردش HTTP اضافه و شکست در build برای صفحات prerender شده) — مستقیم `import { db }` یا سرویس.

### کوکی/سشن در RSC در برابر Route Handler

در Next 16 هر دو API async اند:

```ts
// RSC / Server Action — سشن از next/headers
import { headers } from 'next/headers'
const session = await auth.api.getSession({ headers: await headers() })

// Route Handler — سشن از خود request
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers })
}
```

(بخش ۵ همین الگو را با better-auth کامل می‌کند.)

### اعتبارسنجی Zod بدون @hono/zod-validator

هیچ validator رسمی Route-Handler برای Next وجود ندارد و لازم هم نیست — یک helper نازک کافی است (مستندات رسمی فقط می‌گویند: «داده را قبل از عبور به سیستم‌های دیگر validate کنید») :

```ts
// src/lib/api/validate.ts
import type { ZodType } from 'zod'
import { ApiError } from './error'

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown
  try { body = await request.json() } catch { throw ApiError.badRequest('invalid JSON body') }
  const result = schema.safeParse(body)
  if (!result.success) throw ApiError.validation(result.error.issues) // 400
  return result.data
}

export function parseQuery<T>(request: NextRequest, schema: ZodType<T>): T {
  const raw = Object.fromEntries(request.nextUrl.searchParams) // همه string — schema با z.coerce تمیز می‌کند
  const result = schema.safeParse(raw)
  if (!result.success) throw ApiError.validation(result.error.issues)
  return result.data
}
```

نکته‌های Zod 4 (از [مستندات error formatting](https://zod.dev/error-formatting)): هر issue در `error.issues` شامل `code`، `message`، `path` است؛ برای شکل‌دادن به خطا `z.flattenError` / `z.treeifyError` / `z.prettifyError` وجود دارند (`error.flatten()` شیوهٔ Zod 3 است — استفاده نکن). برای فرم‌های `FormData`، مستندات رسمی Route Handler به [`zod-form-data`](https://www.npmjs.com/package/zod-form-data) اشاره می‌کند (لازم نیست اگر Action استفاده کنیم).

### قرارداد خطا: problem+json (RFC 9457)

به‌جای فرمت خطای خودساخته، استاندارد باز [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457) (جولای 2023، جانشین RFC 7807؛ `application/problem+json`؛ اعضای استاندارد `type`, `title`, `status`, `detail`, `instance` + اعضای الحاقی که کلاینت‌ها باید نادیده بگیرند). اکوسیستم‌ها (فریم‌ورک‌های .NET، Spring، …) همین را به‌عنوان قرارداد REST دارند و برای «وب + موبایل با یک قرارداد» بهترین انتخاب بدون وابستگی است:

```ts
// src/lib/api/error.ts
export class ApiError extends Error {
  constructor(readonly problem: Problem) { super(problem.title) }
  static badRequest(detail: string) { return new ApiError({ type: 'https://expensi.app/problems/bad-request', title: 'Bad Request', status: 400, detail }) }
  static validation(issues: ZodIssue[]) {
    return new ApiError({ type: 'https://expensi.app/problems/validation', title: 'Validation failed', status: 400,
      detail: 'یک یا چند فیلد نامعتبر است.', errors: issues.map(i => ({ path: i.path.join('.'), code: i.code, message: i.message })) })
  }
  static notFound() { /* 404 /problems/not-found */ }
  static unauthorized() { /* 401 /problems/unauthorized */ }
}

// src/lib/api/respond.ts
export function problemResponse(e: unknown): Response {
  if (e instanceof ApiError) return Response.json(e.problem, { status: e.problem.status, headers: { 'Content-Type': 'application/problem+json' } })
  console.error(e) // لاگ سمت سرور — پیام خام به کلاینت نده (توصیهٔ صریح مستندات)
  return Response.json({ type: 'https://expensi.app/problems/internal', title: 'Internal Server Error', status: 500 }, { status: 500, headers: { 'Content-Type': 'application/problem+json' } })
}
```

و یک handler واقعی این شکلی درمی‌آید (کوچک، خوانا، تست‌پذیر):

```ts
// src/app/api/v1/expenses/route.ts
import { z } from 'zod'
import { parseJson } from '@/lib/api/validate'
import { problemResponse } from '@/lib/api/respond'
import { requireSession } from '@/lib/api/auth'
import { expenseService } from '@/services/expense-service'

const createExpense = z.object({
  amount: z.int().positive(),                    // صحیح تومان — مدل تیکت ۰۵
  categoryId: z.string(), occurredAt: z.iso.date(),
  note: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession(request)          // 401 problem+json
    const input = await parseJson(request, createExpense)   // 400 problem+json
    const expense = await expenseService.create(session.user.id, input)
    return Response.json(expense, { status: 201 })
  } catch (e) { return problemResponse(e) }
}
```

(`z.int()` / `z.iso.date()` توابع توپ‌لول Zod 4 هستند؛ اگر نسخه‌ای رفتار متفاوت داشت، در تست تیکت ۱۱ گیر می‌افتد.)

## 3. مصرف تایپ‌سیف API خودِ Next (بدون `hc` هونو)

چهار گزینه، صادقانه:

| گزینه | تایپ‌سیفی برای وب | REST خام برای موبایل | هزینه | حکم |
|---|---|---|---|---|
| **A. fetch wrapper تایپ‌شده + اشتراک Zod schema** | خوب (خروجی با `z.infer` تایپ و در مرز، revalidate می‌شود) | بله — همان REST | تقریباً هیچ؛ نگهداشت دستی نقشهٔ endpointها | **انتخاب الان** |
| **B. OpenAPI از Zod** (`zod-openapi` 6 → `openapi.json` → `openapi-typescript` 7 + `openapi-fetch`) | عالی (کلاینت تولیدی از spec) | بله — spec واقعی برای تیم موبایل/Postman | یک لایهٔ اعلامی اضافه؛ ریسک drift اگر handlerها را از spec بسازیم نه برعکس | **وقتی موبایل نزدیک شد فعال شود** |
| C. tRPC 11 | عالی داخل اکوسیستم tRPC | **خیر** — پروتکل tRPC (query string با نام procedure) | دور ریختن REST؛ OpenAPI رسمی ندارد (`trpc-openapi` از 2024-11 مرده) | رد |
| D. oRPC 1.15 | عالی (`RouterClient<typeof router>`) | بله — «همان router را به‌صورت REST هم serve می‌کند» با OpenAPI Handler | فریم‌ورک دوم روی Route Handlerها؛ برای اپ کوچک ما انحراف مفهومی امروز است | زاپاس؛ اگر درد تایپ‌سیفی وب جدی شد، مهاجرت تدریجی به D + spec، بدون دور انداختن REST ممکن است |

توصیه: **الان A، بعداً B.** زیرساخت A همان schemaهای Zodِ handlerهاست — یعنی تایپ‌ها به‌طور ساختاری با قرارداد API هم‌منبع‌اند و کلاینت وب می‌تواند پاسخ‌های حساس را دوباره parse کند:

```ts
// src/lib/api-client.ts — سمت وب (کلاینت کامپوننت‌ها)
import type { z } from 'zod'
import { expenseSchema } from '@/lib/schemas'

export async function apiFetch<T>(path: string, init?: RequestInit, schema?: ZodType<T>): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { credentials: 'include', ...init })
  if (!res.ok) throw await ApiProblem.fromResponse(res)      // problem+json → خطای دامنه‌دار
  const data = await res.json()
  return schema ? schema.parse(data) : (data as T)           // revalidate در مرز
}
```

و جریان B (بعداً): با `zod-openapi` از همان schemaها + مسیرها، `app/api/v1/openapi.json/route.ts` را build-time یا در dev تولید کنید؛ موبایل spec می‌گیرد، وب هم با `openapi-typescript` + `openapi-fetch` کلاینت تولیدی و تایپ‌دار می‌گیرد. چون منبع هر دو یک schema است، drift حداقل می‌ماند. این تصمیم باید در تیکت ۱۲ (معماری) تثبیت شود.

## 4. مصرف Drizzle/Turso از داخل Next.js (خلاصه — تیکت ۰۹ صاحب جزئیات)

- **جای سکونت:** `src/db/index.ts` (کلاینت `drizzle(client)`) + `src/db/schema.ts`. همه‌جا (RSC و Route Handler) `import { db } from '@/db'` — بدون HTTP hop و بدون لایهٔ جدا.
- **Singleton برای HMR:** الگوی رسمی [راهنمای Drizzle برای Next.js](https://orm.drizzle.team/docs/guides/nextjs) (ذخیرهٔ کلاینت روی `globalThis` در محیط توسعه تا هر hot-reload اتصال نسازد) — کد دقیق per-context (dev = `file:./local.db`، prod = URL ریموت + توکن) در **§۳.۴ تحقیق ۰۹** است؛ عیناً همان پیاده‌سازی شود.
- در serverless (Vercel) هر instance اتصال خودش را می‌سازد؛ چون `@libsql/client` اتصال HTTP ریموت است این مشکلی ایجاد نمی‌کند (embedded replica هم طبق تیکت ۰۹ منتفی است).
- **migrate در دیپلوی** (`drizzle-kit migrate` در CI یا pre-deploy) — جریان کامل در **§۴ تحقیق ۰۹**؛ اینجا تکرار نمی‌شود.

## 5. Auth: better-auth 1.7.3 در برابر Auth.js v5

| معیار | better-auth 1.7.3 | Auth.js / NextAuth v5 |
|---|---|---|
| بلوغ | v1 پایدار، انتشار فعال (1.7.3 دقیقاً 2026-09-06) | **هنوز `5.0.0-beta.32`** (کانال نصب رسمی `next-auth@beta`)؛ `@auth/core` هنوز 0.x |
| یکپارچگی Next.js | مستند رسمی Next (mount با `toNextJsHandler`، `auth.api.getSession`، پلاگین `nextCookies()`) — «کاملاً سازگار با Next 16» و راهنمای `proxy.ts` | مستند v5 + راهنمای مهاجرت از Auth.js به Better Auth |
| جهت‌گیری پروژه | رشد فعال | **Auth.js از 2025-09-22 ضمیمهٔ Better Auth شده**؛ برای پروژه‌های جدید: «strongly recommend new projects to start with Better Auth»؛ فقط وصلهٔ امنیتی |
| ایمیل+رمز | داخلی: `emailAndPassword: { enabled: true }`، هش scrypt (توصیهٔ OWASP)، endpointهای `POST /sign-up/email` و … | Credentials provider: «به‌طور پیش‌فرض داده‌ای در DB ذخیره نمی‌کند» — هش/ریست/رمز خودتان؛ خود مستندات جریان‌های مدرن‌تر را توصیه می‌کند |
| سشن وب | سشن DB به‌عنوان پیش‌فرض + کوکی httpOnly | database یا jwt strategy (کوکی) |
| موبایل / توکن | پلاگین [`bearer()`](https://better-auth.com/docs/plugins/bearer): `Authorization: Bearer <token>`، هدر `set-auth-token` بعد از sign-in — «فقط برای APIهایی که کوکی ندارند» | راه اول‌درجه برای REST API خودی ندارد (طراحی‌اش دور OAuth/وب است) |
| آداپتور Drizzle | `@better-auth/drizzle-adapter` **هم‌نسخه با core**؛ در تیکت ۰۳ با `provider: "sqlite"` روی SQLite تأیید شد | `@auth/drizzle-adapter` 1.11.3 (انتشار 2026-07-20، همگام با آخرین @auth/core) |

**توصیه: better-auth 1.7.3** — نه فقط به‌خاطر بلوغ و پوشش کامل نیازها (ایمیل+رمز، سشن کوکی وب، Bearer برای موبایل، Drizzle)، بلکه چون مسیر آیندهٔ Auth.js هم عملاً به همین پروژه است؛ ورود با better-auth یعنی قرار گرفتن در خط اصلی اکوسیستم، نه روی شاخه‌ای که فقط وصله می‌گیرد. (تثبیت نهایی و پیکربندی auth = تیکت ۱۲.)

**پیاده‌سازی مرجع روی Next 16** (از [مستندات رسمی یکپارچگی](https://better-auth.com/docs/integrations/next)):

```ts
// src/lib/auth.ts
import { betterAuth } from 'better-auth'
import { bearer } from 'better-auth/plugins'            // برای موبایل (بخش پایین همین جدول)
import { nextCookies } from 'better-auth/next-js'       // لازم برای signOut در Server Action
import { drizzleAdapter } from '@better-auth/drizzle-adapter' // پکیج هم‌نسخه با core (تیکت ۰۳)
import { db } from '@/db'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite' }),   // drizzle-orm/libsql — dialect sqlite
  emailAndPassword: { enabled: true },
  plugins: [bearer(), nextCookies()],
  trustedOrigins: [process.env.APP_URL!],
})
```

```ts
// src/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/lib/auth'
export const { GET, POST } = toNextJsHandler(auth)
```

**یک عدم‌قطعیت صادقانه:** مستندات آداپتور Drizzle فقط `provider: "sqlite" | "pg" | "mysql"` را نام می‌برد و **Turso/libSQL را صریحاً ذکر نمی‌کند**. مسیر «drizzle-orm/libsql + provider: sqlite» همان چیزی است که در تیکت ۰۳ استفاده شد و از نظر معماری درست است (آداپتور از instance Drizzle مصرف می‌کند، نه مستقیم از درایور)؛ ولی چون رسمی مستند نشده، در اولین smoke test (اولین سناریوی پیاده‌سازی) ثبت‌نام/ورود با لوکال DB باید تأیید شود.

**JWKS/ذخیرهٔ توکن موبایل:** برای موبایل، `bearer()` کافی است (توکن سشن موجود در هدر Authorization می‌رود)؛ API key جداگانه فعلاً scope نیست — در صورت نیاز بعدی، پلاگین‌های ecosystem (مثل API key) آن موقع ارزیابی می‌شود.

## 6. دیپلوی — یک پاراگراف

برای اپ شخصی تک‌کاربره با دیتابیس ریموت Turso، **پیش‌فرض عملی Vercel (پلن hobby)** است: صفر-کانفیگ، build با Turbopack، و Route Handlerها به‌صورت serverless — که با معماری ما سازگار است چون state روی Turso (HTTP ریموت) است و چیزی روی دیسک lambda نمی‌خواهیم (همان محدودیت‌هایی که مستندات برای serverless می‌گوید: دیسک موقت، timeout، عدم WebSocket — به ما نخورده). **پلن B، self-host** با `next start` یا Docker پشت یک reverse proxy است که طبق [راهنمای رسمی self-hosting](https://nextjs.org/docs/app/guides/self-hosting) همهٔ قابلیت‌های اصلی (بهینه‌سازی تصویر، proxy، ISR/کش، streaming، `after`) را پشتیبانی می‌کند؛ ارزش واقعی‌اش سناریوی «دسترسی سخت شد» است — همان ریسک دسترسی از ایران که تیکت ۰۹ برای Turso ثبت کرده، برای Vercel هم صادق است و باید در تیکت ۱۲ (معماری/دیپلوی) یک‌بار عملاً تست شود.

## 7. منابع (همه با تاریخ دسترسی 2026-09-06)

- npm registry via `npm view` — next, react, typescript, tailwindcss, eslint, zod, better-auth, next-auth, @auth/core, @trpc/server, @orpc/server, zod-openapi, @asteasolutions/zod-to-openapi, openapi-typescript, @next/swc-win32-x64-msvc
- [Next.js 16 — blog رسمی انتشار](https://nextjs.org/blog/next-16)
- [Route Handlers (route.js reference)](https://nextjs.org/docs/app/api-reference/file-conventions/route) — نسخهٔ سند 16.3.4
- [Backend for Frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend) — نسخهٔ سند 16.3.4
- [Mutating Data (Server Functions/Actions)](https://nextjs.org/docs/app/getting-started/mutating-data) — نسخهٔ سند 16.3.4
- [create-next-app reference](https://nextjs.org/docs/app/api-reference/cli/create-next-app) — نسخهٔ سند 16.3.4
- [TypeScript config](https://nextjs.org/docs/app/api-reference/config/typescript) — نسخهٔ سند 16.3.4
- [Self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting) — نسخهٔ سند 16.3.4
- قالب create-next-app در سورس Next.js (`packages/create-next-app/templates/app/ts/` — tsconfig با `strict: true`، eslint.config.mjs flat config)
- [better-auth: Next.js integration](https://better-auth.com/docs/integrations/next)
- [better-auth: Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [better-auth: Email & Password](https://better-auth.com/docs/authentication/email-password)
- [better-auth: Bearer plugin](https://better-auth.com/docs/plugins/bearer)
- [authjs.dev — installation](https://authjs.dev/getting-started/installation) و [credentials provider](https://authjs.dev/getting-started/authentication/credentials)
- [Auth.js joins Better Auth — بیانیهٔ رسمی](https://better-auth.com/blog/authjs-joins-better-auth)
- [oRPC docs](https://orpc.dev) (OpenAPI handler، Next.js integration، Standard Schema)
- [Zod 4 — error formatting](https://zod.dev/error-formatting)
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457) (rfc-editor.org — متنی)
