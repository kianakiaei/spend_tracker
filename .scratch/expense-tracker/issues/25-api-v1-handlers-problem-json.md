# 25 — API v1 (Route Handlers) + problem+json + proxy + fetch wrapper تایپ‌شده

Type: task
Status: open
Blocked by: 22, 23, 24

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
