# 25 — API v1 (Route Handlers) + problem+json + proxy + fetch wrapper تایپ‌شده

Type: task
Status: resolved
Blocked by: 22, 23, 24
Assignee: IDEHAL (agent session, 2026-09-06)

## Question

تمام قرارداد API تیکت ۱۲ + پیوست‌های ۱۵/۰۸ — همهٔ CRUD دامنه Route Handler زیر `src/app/api/v1/...`؛ handler نازک: parse → سرویس → پاسخ:

- منابع: `expenses` (POST؛ GET با `?month=`؛ GET/PATCH/DELETE روی `[id]`)؛ `categories` (GET/POST؛ PATCH/DELETE روی `[id]` — DELETE پُر = **409**؛ `POST [id]/move-expenses` با `{"targetCategoryId"}`)؛ `recurring-templates` (GET/POST؛ PATCH/DELETE روی `[id]`؛ **`GET preview?month=`** فقط آینده)؛ `summaries` (GET با `?month=`)؛ `classify` (POST `{"title"}` → همیشه 200 با `{ categoryId, source: 'learned'|'system'|'fallback', matchedKey, confidence: {purity, support} | null }` — بی‌اثر).
- اعتبارسنجی با helper نازک `parseJson`/`parseQuery` روی Zod 4 (اسکیماها از `src/lib/schemas` — DTOهای درخواست/پاسخ اینجا کامل می‌شوند و بین handler/سرویس/کلاینت مشترک‌اند).
- **خطا = problem+json (RFC 9457)** با `type/title/status/detail` + آرایهٔ `errors` (path/code/message) برای اعتبارسنجی؛ 400 فیلد نامعتبر، 401 بدون سشن، 404 id ناشناخته، 409 حذف دستهٔ پُر، 500 بدون درز پیام داخلی. opId/If-Match در v1 نیست (تصمیم ۱۲).
- auth در handler: `auth.api.getSession` با هدرهای request — کوکی وب و `Authorization: Bearer` هر دو شفاف (پلاگین bearer از ۱۸)؛ 401 با problem+json.
- `proxy.ts` (جانشین middleware در Next 16): فقط **presence کوکی** با `getSessionCookie` (از `better-auth/cookies`) و ریدایرکت خوش‌بینانه به `/login` — اعتبارسنجی نیست؛ استثناها: `/api/v1/*` (401 را خود handler می‌دهد)، `/api/auth/*`، فایل‌های ایستا.
- **fetch wrapper تایپ‌شده** برای کلاینت وب روی همان `/api/v1` با اشتراک Zod schema (`z.infer`) — یک مسیر برای وب و موبایل؛ RSC هرگز handler خود را fetch نمی‌کند (مستقیم سرویس). OpenAPI الان ساخته نمی‌شود (فقط در آستانهٔ موبایل — تیکت ۱۰).

## Test plan

- integration قراردادی — هر handler به‌عنوان تابع معمولی با `Request` ساختگی و سشن mocked روی فایل temp + migrator: 401 بدون سشن (problem+json درست)، 400 با `errors[]`، 404، 409، خوشی کامل هر endpoint، مسیر Bearer، شکل دقیق classify، preview فقط برای ماه آینده و شکل سطرش، `GET /api/v1/expenses?month=` آینده فقط خرج‌های واقعی.

## Comments

- 2026-09-06 — **رزول شد: API v1 کامل سبز — همهٔ handlerهای تیکت ۱۲ + problem+json (RFC 9457) + proxy + fetch wrapper تایپ‌شده؛ ۲۵۵ پاس (۲۱ فایل)، lint/tsc تمیز** — آستانه‌های per-glob پابرجا: schemas ۱۰۰/۱۰۰، services ۹۸٫۲/۹۲٫۳ (آستانهٔ ۸۰/۸۰)، لایهٔ api ۸۶٫۹/۹۵٫۱ (بدون آستانه — بستن نهایی با ۳۰). ساختار: `src/lib/api/` (problem/parse/session/route/client + problem-body) ، `src/lib/schemas/api.ts` (DTOهای درخواست/پاسخ)، `src/app/api/v1/**` (۱۰ فایل route)، `src/proxy.ts`. تصمیم‌های تفسیری ثبت‌شده:
  - **handlerها نازک و تابع معمولی‌اند** — `withRoute(async (request, ctx) => …)` با امضای Next 16 (ctx با params به‌صورت Promise)؛ تست‌ها handler را مستقیم صدا می‌زنند. سرویس‌ها در سطح ماژول route با `db` گلوبال ساخته می‌شوند؛ `requireUserId` قبل از parse (401 همیشه مقدم بر 400).
  - **POST خرج = بدنه + `entryMonthKey`** — «ماه فرم» که سرویس پارامتر جدا می‌گیرد در همان بدنه می‌آید؛ خرج تاریخ‌دار همیشه به ماه خودش می‌رود (تست: 2026-01-15 → 1404-10 با entryMonthKey ماه جاری). پاسخ POST رد سادهٔ خرج است (بدون category توکار)؛ شکل join شده مال GET [id] و GET ?month=.
  - **`GET preview?month=` ماه جاری/گذشته = 200 []** (نه 400) — گیت «فقط آینده» سرویس ۲۳ است و endpoint همان را آینه می‌کند؛ شکل سطر `{templateId, title, amountToman, categoryId, day}` با تست «نه id نه monthKey دارد».
  - **`invalid_json` یک کد 400 جداست** (additive) — بدنهٔ غیرJSON هرگز به اسکیما نمی‌رسد؛ errors[] فقط برای خطای اسکیما (اعتبارسنجی) می‌آید. کلاینت هم بدنه‌های non-problem (صفحهٔ crash پراکسی و…) را به شکل یکنواخت `/problems/unknown` می‌پیچد.
  - **درج کشف سشن با `auth.handler` واقعی، نه mock دستی** — طرح تست «سشن mocked» می‌گفت؛ تست‌ها session واقعی از مسیر ثبت‌نام better-auth روی فایل temp می‌سازند (کوکی + `set-auth-token`) که سخت‌گیرانه‌تر است و هر دو مسیر کوکی/Bearer را روی همان handlerهای تولیدی می‌پوشاند.
  - **additive دیده‌شده:** پاسخ‌های runtime-validated کلاینت با اسکیمای مشترک (ZodError = باگ قرارداد، نه خطای کاربر)؛ 409های `system_category_protected`/`duplicate_category_name` از تیکت‌های ۰۵/۲۲؛ فیلد `errors` با path سطح-فرم برای issueهای بی‌مسیر. کاربر واردشده روی `/login` → `/` عمداً به تیکت ۲۹ (UX auth) سپرده شد — proxy این تیکت فقط presence کوکی + ریدایرکت به /login است، با استثناهای گسترده‌تر ایستا (robots.txt/sitemap.xml/manifest.json و پسوندهای asset).
  - **از code-review (دو محور) اعمال شد:** حذف تکرار ProblemBody/ProblemErrorEntry با برگ اختصاصی `problem-body.ts` (قابل‌حمل به باندل موبایل)، `IdCtx` مشترک کنار withRoute، نام‌های صریح‌تر کلاینت (`readValidated`/`expectNoBody`)، sweep 401 همهٔ endpointها (شامل templates/preview/summaries)، و تست یونیت «500 بدون درز پیام داخلی». محور Spec: همهٔ بندهای تیکت و طرح تست پوشش داده شد، بدون نقص.
  - گام بعدی: تیکت‌های ۲۶ (پوستهٔ UI) و ۲۷/۲۸/۲۹ (که حالا از ۲۵ آزادند).
