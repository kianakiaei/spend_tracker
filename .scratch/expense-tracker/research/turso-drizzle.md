# پژوهش: راه‌اندازی Turso (libSQL) + Drizzle ORM روی پلن رایگان

تاریخ پژوهش: 2026-09-06. سقف‌ها و قیمت‌ها از صفحهٔ رسمی pricing تورسو، رفتارها از مستندات رسمی docs.turso.tech، محتوای درایور از مخزن رسمی مستندات Drizzle (`drizzle-team/drizzle-orm-docs`، شاخهٔ main — نکته: دامنهٔ `orm.drizzle.io` از محیط این پژوهش قابل fetch نبود؛ محتوای همان مستندات مستقیماً از مخزن رسمی خوانده شد) و نسخه‌ها مستقیماً از npm registry استخراج شده است. علاوه بر منابع، دو آزمون اجرایی واقعی روی همین ویندوز انجام شد: (۱) نصب `@libsql/client@0.18.0` و اجرای موفق کوئری روی فایل لوکال، (۲) اجرای کامل `drizzle-kit generate` + `drizzle-kit migrate` با `dialect: 'turso'` روی یک فایل لوکال — هر دو با موفقیت.

## TL;DR — توصیه

1. **سه context، یک درایور:** همه‌جا `drizzle-orm/libsql` + `@libsql/client` (زیرمسیر node). فقط `TURSO_DATABASE_URL` بین contextها عوض می‌شود:
   - **dev:** `file:./local.db` — فایل لوکال، بدون توکن، بدون اینترنت. (تأیید اجرایی روی ویندوز)
   - **test (integration):** فایل موقتی per-run + اجرای migrationها با `drizzle-orm/libsql/migrator` — ایزوله و سریع.
   - **prod (Vercel):** `libsql://<db>-<org>.turso.io` + `TURSO_AUTH_TOKEN` (database token) — اتصال HTTP ریموت.
2. **نسخه‌ها:** `drizzle-orm@0.45.2`، `drizzle-kit@0.31.10`، `@libsql/client@0.18.0` (با پیش‌ساخت ویندوزی `@libsql/win32-x64-msvc@0.5.29` — بدون node-gyp).
3. **پلن رایگان واقعاً کافی است** برای کاربر تکی: 100 دیتابیس، 5GB storage، 500M rows read/ماه، 10M rows written/ماه، 3GB sync/ماه. ولی دو تله دارد: (الف) با رد شدن سقفِ *هر یک* معیار، دیتابیس کاملاً **BLOCKED** می‌شود (پلن رایگان overage ندارد)؛ (ب) دیتابیسِ بیکار پس از **10 روز بدون فعالیت آرشیو می‌شود** (با `turso group unarchive` برمی‌گردد).
4. **Migrationها:** جریان `drizzle-kit generate` (فایل‌های SQL کامیت می‌شوند) + `drizzle-kit migrate` برای اعمال. الگوی رسمی Turso برای دیپلوی Vercel: `"build": "drizzle-kit migrate && next build"` — یعنی migrate در مرحلهٔ build. برای اپ تک‌کاربر، اجرای دستی `pnpm db:migrate` از ماشین توسعه هم گزینهٔ امن‌تری است.
5. **پاریتی لوکال/ریموت بالا** (همان libSQL و همان درایور)، ولی دو تفاوت پرچم‌دار: enforcement کلید خارجی به‌صورت پیش‌فرض **خاموش** است (سازگاری با SQLite — قاعدهٔ «منع حذف دستهٔ پُر» باید در لایهٔ اپ هم تضمین شود) و چند PRAGMA (`busy_timeout`, `journal_mode`) روی Turso Cloud پشتیبانی نمی‌شوند.
6. **خروج آسان است:** `turso db export` یک فایل SQLite معمولی می‌دهد؛ embedded replica هم عملاً یک کپی زندهٔ لوکال نگه می‌دارد. مهاجرت بعدی به Postgres برای این اسکیمای کوچک متوسط و دست‌یافتنی است.
7. **ریسک اصلی غیرفنی — ایران:** Turso یک شرکت آمریکایی است و هیچ بیانیهٔ عمومیِ مکتوبی دربارهٔ محدودیت کشورها پیدا نشد (نامشخص = نامشخص ثبت شد). ثبت‌نام/دسترسی/پرداخت از ایران باید *اول از همه* عملاً تست شود؛ اگر ممکن نبود، تصمیم تعویض سرویس با کاربر است — هیچ راه دورزدنی توصیه نمی‌شود.

## 1. نسخه‌ها و سقف‌ها (2026-09-06)

| مورد | مقدار | نکات | منبع + تاریخ دسترسی |
|---|---|---|---|
| drizzle-orm | **0.45.2** | MIT؛ ورودی `drizzle-orm/libsql` | [npm](https://www.npmjs.com/package/drizzle-orm)، دسترسی 2026-09-06 |
| drizzle-kit | **0.31.10** | CLI مهاجرت؛ `dialect: 'turso'` و `'sqlite'` | [npm](https://www.npmjs.com/package/drizzle-kit)، 2026-09-06 |
| @libsql/client | **0.18.0** (dist-tag next: 0.17.3-pre.2) | درایور رسمی JS برای Turso Cloud؛ «the package to use for ORM integration (Drizzle, Prisma)» | [npm](https://www.npmjs.com/package/@libsql/client)، [docs.turso.tech/sdk/ts/quickstart](https://docs.turso.tech/sdk/ts/quickstart)، 2026-09-06 |
| libsql (ماژول نیتیو) | **0.5.29** | پیش‌ساخت‌ها: darwin-x64/arm64، linux-x64/arm64 (gnu/musl)، **win32-x64-msvc** | `npm view libsql optionalDependencies`، 2026-09-06 |
| @tursodatabase/database | 0.7.2 (نسخهٔ جدید SQLite بازنویسی‌شده به Rust) | برای use-case لوکال/embedded توصیه شده؛ پیش‌ساخت win32 هم دارد؛ **برای ما لازم نیست** — مسیر libSQL پایدار است | [npm](https://www.npmjs.com/package/@tursodatabase/database)، [docs.turso.tech/local-development](https://docs.turso.tech/local-development)، 2026-09-06 |
| Turso Cloud — پلن Free | 100 دیتابیس، 5GB storage، 500M rows read/ماه، 10M rows written/ماه، 3GB Embedded Sync/ماه، PITR **1 روز**، بدون Audit Log/Team/SSO | «Start free today, no credit card required» | [turso.tech/pricing](https://turso.tech/pricing)، 2026-09-06 |
| پلن‌های پولی (برای مقیاس آینده) | Developer $4.99/mo: دیتابیس نامحدود، 9GB، 2.5B read، 25M write، 10GB sync، PITR 10 روز | Scaler $24.92، Pro $416.58 | همان منبع، 2026-09-06 |
| رفتار سقف در Free | رد شدن از سقف هر معیار (storage/read/write/sync) → دیتابیس‌ها **blocked** حتی اگر بقیهٔ معیارها زیر سقف باشند؛ overage فقط پلن‌های پولی | + «Vegas Blackout» (حذف یک روز بد از فاکتور، ماهی یک‌بار — فقط پولی) | [pricing FAQ](https://turso.tech/pricing) (JSON-LD صفحه)، 2026-09-06 |
| آرشیو خودکار | «Databases get archived after 10 days of inactivity for users on a free plan» → برگشت با `turso group unarchive <group>` | معادل «auto-sleep» فعلی پلتفرم | [docs.turso.tech/cli/group/unarchive](https://docs.turso.tech/cli/group/unarchive)، 2026-09-06 |
| نحوهٔ شمارش rows read/write | proxy برای compute: هر ردیفِ *دست‌خورده* شمرده می‌شود نه فقط خروجی؛ ایندکس‌گذاری درست = مصرف کمتر؛ Drizzle Studio هم read/write حساب می‌شود | برای کوئری‌های جمعِ ماهانه با ایندکس، اعداد ناچیزند | [pricing FAQ](https://turso.tech/pricing) + [help/usage-and-billing](https://docs.turso.tech/help/usage-and-billing)، 2026-09-06 |

نکتهٔ شمارش: هر فریم sync/page معادل **4KB** است؛ «Monthly Syncs» حجم جابه‌جایی صفحه‌ها بین Turso Cloud و دیتابیس embedded لوکال است (FAQ pricing). برای اپ ما (بدون embedded replica در prod) مصرف sync تقریباً صفر است.

## 2. پلتفرم Turso در سپتامبر 2026

### 2.1 دو موتور، یک پلتفرم

پلتفرم «Turso Cloud» دو موتور دارد ([docs.turso.tech/turso-cloud](https://docs.turso.tech/turso-cloud)، 2026-09-06):

- **libSQL** — fork battle-tested SQLite؛ «battle-tested in production on Turso Cloud for years». دیتابیس‌های معمولی `turso db create` روی همین موتورند.
- **Turso Database** — بازنویسی از صفرِ SQLite به Rust با concurrent writes؛ صراحتاً «in early preview» (ساخت با `turso db create --tursodb`).

**تصمیم برای ما:** روی مسیر پایدار **libSQL** می‌مانیم (همان که Drizzle و `@libsql/client` رسماً ساپورت می‌کنند). موتور جدید Rust فعلاً خارج از محدودهٔ ریسک‌پذیری این پروژه است.

### 2.2 ساختار: group / database / location

دیتابیس‌ها داخل **group** ساخته می‌شوند (location روی group تنظیم می‌شود؛ blast-radius و توکن‌دهی هم group-level است). Free اجازهٔ 100 دیتابیس می‌دهد — برای ما: یک دیتابیس prod (+ شاید یک دیتابیس تست/shared). ([docs.turso.tech](https://docs.turso.tech/turso-cloud) و CLI reference، 2026-09-06)

### 2.3 ریجن‌ها — نزدیک‌ترین به ایران

- کدهای location در پلتفرم فعلی به نام‌گذاری AWS مهاجرت کرده‌اند. **تأیید زندهٔ اجرایی (2026-09-06):** `curl https://region.turso.io` از این ماشین → `{"server": "aws-eu-west-1", "client": "cdg"}` — یعنی endpoint تشخیص نزدیک‌ترین ریجن کار می‌کند و کدها شکل `aws-*` دارند (aws-eu-west-1 = ایرلند).
- مستندات API ([locations/list](https://docs.turso.tech/api-reference/locations/list)) فهرست کامل را نمی‌دهد (فقط نمونهٔ spec). **فهرست قطعیِ فعلی از منبع اولیه در دسترس نبود — عدم قطعیت صریح.** راه قطعی: بعد از نصب CLI، `turso db locations --show-latencies` ([cli/db/locations](https://docs.turso.tech/cli/db/locations)) که latency واقعی از محل شما نشان می‌دهد.
- انتظار عملی برای ایران: کم‌ترین latency معمولاً ریجن‌های اروپا/شرق مدیترانه است (در لیست‌های تاریخی تورسو کدهایی مثل `ist`، `dxb`، `ath`، `fra`، `waw` وجود داشتند — کدهای تاریخی، معادل AWS آنها باید از خروجی CLI چک شود). **انتخاب نهایی ریجن به زمان ثبت‌نام موکول می‌شود** (طبق map.md هم به تیکت ۱۲ وابسته است)؛ محدودیت ریجن در پلن رایگان در مستندات دیده نشد.

### 2.4 توکن‌ها — دو مدل متفاوت

| نوع | ساخت | کاربرد | expiry |
|---|---|---|---|
| **Platform API token** | `turso auth api-tokens mint <name> --org <slug>` (یا API: `POST /v1/auth/api-tokens/{name}`) | اتوماسیون CLI و Platform API — **نه** برای اتصال SQL اپ | در مستندات فعلی **هیچ expiry‌ای مستند نشده** (عدم قطعیت صریح)؛ scoping سطح org یا group با scopeهای `read`, `db:create`, …، `full-access`؛ توکن cross-org deprecated است. «Unrestricted tokens are deprecated» |
| **Database token** (اعتبارنامهٔ SQL) | `turso db tokens create <db> [--expiration never|7d|…] [--read-only]` | همان `authToken` که در `createClient` می‌گذاریم | flag `--expiration`: «can be `never` or a value in days, e.g. `7d`»؛ **پیش‌فرض در مستندات ذکر نشده** (عدم قطعیت) — صراحتاً مقدار بدهیم |

منابع: [cli/auth/api-tokens/mint](https://docs.turso.tech/cli/auth/api-tokens/mint)، [api-reference/tokens/create](https://docs.turso.tech/api-reference/tokens/create)، [cli/db/tokens/create](https://docs.turso.tech/cli/db/tokens/create) — 2026-09-06.

همچنین مدل جدید «Scoped Access Tokens» با permissions ریزتر (database/table/action) و امکان صدور توکن توسط identity provider خودمان از طریق **JWKS** وجود دارد ([sdk/authorization](https://docs.turso.tech/sdk/authorization)) — برای اپ تک‌کاربر لازم نیست؛ یادداشت آینده‌نگری.

**توصیهٔ عملی:** یک database token با `--expiration never` فقط برای اپ prod، و یک توکن read-only برای کوئری‌های ad-hoc. مقدارها هر دو فقط یک‌بار نمایش داده می‌شوند — بلافاصله در password manager/.env بروند (هرگز کامیت نمی‌شوند؛ طبق AGENTS.md).

### 2.5 ریسک‌های دسترسی/ثبت‌نام از ایران — صریح و بدون راه‌حل دورزدن

موارد زیر به‌عنوان **ریسک** ثبت می‌شوند؛ هیچ توصیهٔ دورزدن تحریم/ثبت‌نام در این سند نیست:

1. **مبهم‌بودن وضعیت رسمی (عدم قطعیت تأییدشده):** در صفحهٔ Terms of Use عمومی تورسو هیچ بندی دربارهٔ کشورهای ممنوعه/تحریم/کنترل صادرات پیدا نشد (2026-09-06؛ صفحهٔ terms محتوای JS-only دارد و متن کاملش استخراج نشد — خود این هم یک عدم قطعیت است). هیچ مستند رسمیِ «ایران مجاز/غیرمجاز» پیدا نشد.
2. **شرکت آمریکایی (واقعیت مستند):** آدرس حقوقی در صفحهٔ pricing: «…Pike #6336, Claymont, DE, US» و علامت © Turso 2026 — یعنی تابع قوانین و کنترل صادرات آمریکا. حتی بدون بند صریح، امکان محدودشدن ثبت‌نام یا سرویس‌دهی به IP/کاربر ایرانی وجود دارد و در هر لحظه می‌تواند اعمال شود.
3. **پرداخت (واقعیت ساختاری):** پلن رایگان «no credit card required» است (نقطهٔ مثبت)، ولی هر ارتقای آینده نیاز به کارت بین‌المللی دارد که برای کاربر ایران معمولاً در دسترس نیست — یعنی سقف Free عملاً باید نقطهٔ پایانی هم باشد.
4. **دسترسی شبکه:** reachability دامنه‌های `api.turso.tech` و `*.turso.io` از داخل ایران از اینجا قابل تست نیست (عدم قطعیت). تست عملی اولین گام است.
5. **پیامد طراحی (خنثی‌سازیِ در طراحی، نه دورزدن):** معماری پیشنهادی همین پژوهش عمداً طوری است که اپ به Turso وابستگی کم داشته باشد: توسعه/تست کاملاً روی فایل لوکال، data layer پشت ماژول `src/db`، و خروج با یک `turso db export`. اگر ثبت‌نام ممکن نشد، تصمیم «تعویض سرویس هاست‌شده» یک تصمیم محصولی برای کاربر است (گزینهٔ ساده: فایل libSQL/SQLite روی همان هاست اپ).

## 3. Drizzle روی libSQL — درایور، حالت‌ها، ویندوز

### 3.1 بسته‌ها و نقش‌ها

- `drizzle-orm` — خود ORM؛ ورودی `drizzle-orm/libsql` (+ زیرمسیرهای `/web`, `/sqlite-core`, …).
- `drizzle-kit` — CLI مهاجرت (`generate/migrate/push/pull/studio`)؛ config با `dialect: 'turso'`.
- `@libsql/client` — درایور رسمی؛ مستندات Turso: «the package to use for ORM integration (Drizzle, Prisma)» ([sdk/ts/quickstart](https://docs.turso.tech/sdk/ts/quickstart)).

زیرمسیرهای `@libsql/client` (مستندات رسمی Drizzle — LibsqlTable، مخزن drizzle-orm-docs، 2026-09-06):

| زیرمسیر | پروتکل‌ها |
|---|---|
| `@libsql/client` (node به‌صورت پیش‌فرض) | همهٔ حالت‌ها |
| `@libsql/client/node` | `:memory:`, `file`, `wss`, `http`, `turso` |
| `@libsql/client/web` | برای فریمورک‌های fullstack (next/nuxt/astro)؛ **`file:` ساپورت نمی‌شود** |
| `@libsql/client/http` | `http`/`https` فقط |
| `@libsql/client/ws` | `ws`/`wss` فقط |
| `@libsql/client/sqlite3` | `:memory:`/`file` فقط |

### 3.2 حالت‌های اتصال و اینکه کدام برای کدام context

1. **Remote (HTTP/webSocket):** `createClient({ url: 'libsql://db-org.turso.io', authToken })` — مسیر prod، مخصوصاً روی Vercel که filesystem پایدار ندارد. Turso integration برای Vercel همین را «SQL over HTTP» می‌نامد که «needs only the fetch API» است ([integrations/vercel](https://docs.turso.tech/integrations/vercel)، 2026-09-06). یک نکتهٔ جدی مستند: در جدول مقایسهٔ integration، concurrent writes با `@libsql/client` «Not supported» ولی با `@tursodatabase/serverless` ساپورت می‌شود — برای اپ تک‌کاربر بی‌اهمیت، ولی ثبت شد.
2. **Local file:** `createClient({ url: 'file:local.db' })` یا `drizzle('local.db')` — بدون سرور، بدون توکن، SQLite کامل. **برای dev و integration test.**
3. **Embedded replica:** `file:` + `syncUrl` + `syncInterval` + `client.sync()` — خواندن لوکال، نوشتن به primary ریموت؛ «fully supported in production» ([features/embedded-replicas/introduction](https://docs.turso.tech/features/embedded-replicas/introduction)، 2026-09-06). برای ما در prod (Vercel) **منتفی** است (به filesystem نیاز دارد؛ مستندات: serverless environments without a filesystem cannot use embedded replicas)؛ ارزشش در dev و به‌عنوان حاشیهٔ امنیت خروج است (بخش ۶).
4. **خانوادهٔ جدید `@tursodatabase/*`:** `database` (in-process، SQLite-Rust جدید)، `serverless` (fetch-only برای موتور Turso Database جدید) و `sync` (sync-engine جدید). Drizzle درایورهای آزمایشی دارد (`drizzle-orm/tursodatabase/database`, `drizzle-orm/tursodatabase-serverless`, `drizzle-orm/tursodatabase-sync`) ولی مستندات Turso صراحتاً برای Drizzle همان `@libsql/client` را توصیه می‌کند. برای این پروژه کنار گذاشته شد.

### 3.3 وضعیت ویندوز — تأیید اجرایی (نه فقط ادعای مستندات)

- `libsql@0.5.29` پیش‌ساخت رسمی **`@libsql/win32-x64-msvc@0.5.29`** دارد (`npm view`، 2026-09-06).
- نصب واقعی `@libsql/client@0.18.0` روی همین ویندوز (win32، Node 24): موفق؛ `node_modules/@libsql/win32-x64-msvc/index.node` present؛ کوئری روی `file:local-test.db` اجرا شد (`LOCAL FILE OK [{"one":1}]`).
- یعنی مسیر نیتیو (که embedded replica و `file:` از آن استفاده می‌کنند) روی ویندوز **بدون node-gyp و بدون build محلی** کار می‌کند — ریسک قدیمیِ «Windows ندارند» دیگر برقرار نیست. (عدم قطعیت باقی‌مانده: Bun/Deno — در محدودهٔ پروژه نیستیم.)
- `@tursodatabase/database@0.7.2` هم پیش‌ساخت win32 دارد (اگر روزی لازم شد).

### 3.4 الگوی singleton برای Next.js (جلوگیری از اتصال‌های تکراری با HMR)

الگوی رسمی استارتر Turso ([tursodatabase/nextjs-turso-starter → `db/index.ts`](https://github.com/tursodatabase/nextjs-turso-starter)، 2026-09-06) یک module-level singleton ساده است. برای dev که HDR ماژول را دوباره eval می‌کند، الگوی متداول جامعهٔ Next.js کش روی `globalThis` است (این جزء مستندات رسمی نیست — یادداشت عملی):

```ts
// src/db/index.ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient, type Client } from '@libsql/client';
import * as schema from './schema';

const url = process.env.TURSO_DATABASE_URL; // file:./local.db در dev — libsql://… در prod

const globalForDb = globalThis as unknown as { __spendTrackerClient?: Client };

const client =
  globalForDb.__spendTrackerClient ??
  createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN, // برای file: لازم نیست
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__spendTrackerClient = client;
}

export const db = drizzle(client, { schema });
```

(برای client ریموت HTTP هزینهٔ «connection storm» کم است ولی کش کردن باز هم درست‌تر و ارزان‌تر است.)

## 4. Migrationها با drizzle-kit

### 4.1 Config — یک فایل برای همهٔ contextها

از راهنمای رسمی Turso برای Drizzle ([sdk/ts/orm/drizzle](https://docs.turso.tech/sdk/ts/orm/drizzle)، 2026-09-06) و استارتر رسمی:

```ts
// drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!, // dev: file:./local.db | prod: libsql://…
    authToken: process.env.TURSO_AUTH_TOKEN, // برای فایل لوکال undefined می‌گذرد
  },
});
```

**تأیید اجرایی (2026-09-06، ویندوز):** همین config با `url: 'file:local-dev.db'` → `drizzle-kit generate` فایل SQL ساخت و `drizzle-kit migrate` آن را اعمال کرد (جدول‌های `users` و `__drizzle_migrations` ساخته شدند؛ «migrations applied successfully»). یعنی **لازم نیست برای لوکال dialect را عوض کنیم**؛ همان `dialect: 'turso'` با url فایل کار می‌کند.

### 4.2 جریان توصیه‌شده

- **generate همیشه لوکال:** `drizzle-kit generate` → فایل‌های SQL زیر `drizzle/` → **کامیت** (تاریخچهٔ schema).
- **push فقط برای ایست سریع روی لوکال:** `drizzle-kit push` مستقیم diff می‌زند و فایل migration تولید نمی‌کند — مستندات رسمی Drizzle: «convenient method for quickly testing new schema designs or modifications in a local development environment». استارتر Turso هم README‌اش برای prod می‌گوید «use with caution». پس: prod همیشه با generate+migrate، نه push.
- **migrate برای اعمال:** `drizzle-kit migrate` — هم روی فایل لوکال (تأیید اجرایی) هم روی Turso ریموت (با url+authToken). در prod از `drizzle-orm/libsql/migrator` (تابع `migrate()`) هم می‌توان در تست/بوت استفاده کرد.

### 4.3 اجرای migration در دیپلوی (Vercel)

سه الگوی ممکن، به ترتیب توصیه برای اپ تک‌کاربر:

1. **دستی از ماشین توسعه (پیش‌فرض ما):** قبل/همراه deploy: `pnpm db:migrate` با env ریموت. صفر پیچیدگی، کنترل کامل، عدم race. برای single-user کاملاً کافی.
2. **مرحلهٔ build روی Vercel (الگوی رسمی Turso):** استارتر رسمی: `"build": "npx drizzle-kit migrate && next build"` — Vercel اسکریپت build را اجرا می‌کند و migrate قبل از build به Turso می‌رود. شرط: `TURSO_DATABASE_URL` و `TURSO_AUTH_TOKEN` به‌عنوان env varهای پروژهٔ Vercel ست شده باشند (build step به env دسترسی دارد). توجه: چند build هم‌زمان می‌توانند migrate موازی اجرا کنند — برای ما عملاً تک‌کاربر، ولی مسیر ۱ از این هم مصون است.
3. **گام CI قبل از deploy (GitHub Action):** جای وسط؛ برای این پروژه فعلاً over-engineering.

Gotchaها: (الف) `dotenv/config` در drizzle.config برای خواندن `.env` لوکال لازم است (در Vercel env از خود پلتفرم می‌آید)؛ (ب) `authToken` undefined برای `file:` مشکلی ندارد ولی برای ریموت الزامی است؛ (ج) فایل‌های `drizzle/` باید در deploy در دسترس باشند (کامیت شده‌اند)؛ (د) روی Turso Cloud چند PRAGMA حذف شده‌اند — migrationهای حاوی `PRAGMA journal_mode`/`busy_timeout` را نگذارید (بخش ۵).

## 5. توسعه و تست لوکال

### 5.1 dev روزمره → فایل لوکال (نه turso dev، نه embedded replica)

سه گزینهٔ مستند ([local-development](https://docs.turso.tech/local-development)، 2026-09-06) و انتخاب ما:

| گزینه | چیست | حکم برای ما |
|---|---|---|
| **فایل لوکال** `file:local.db` | «local database file, no server needed (recommended)» طبق مستندات | **انتخاب dev روزمره** — سریع، آفلاین، بدون توکن، همان درایور prod |
| `turso dev` | «will start a local libSQL server and create a database for you» روی `http://127.0.0.1:8080`؛ «Changes will be lost when you stop the server» مگر با `--db-file local.db` | فقط اگر قابلیت سمت‌سرور libSQL (مثل extensionها) لازم شد؛ برای CRUD روزمره ارزش اضافه‌ای ندارد |
| Embedded replica | کپی لوکالِ sync‌شده از ریموت | برای dev روزمره پیچیدگی اضافه؛ فقط به‌عنوان آینهٔ prod (بخش ۶) |

### 5.2 integration test → فایل موقتی per-run + migrator

- هر run تست: یک فایل temp (یا `:memory:` اگر migrate را در-process اجرا کنیم)، سپس اعمال migrationها با `drizzle-orm/libsql/migrator` (تابع `migrate(db, { migrationsFolder: './drizzle' })`) یا یک بار `drizzle-kit migrate` با url فایل تست. نتیجه: دیتابیس ایزوله، تکرارپذیر، و دقیقاً همان کدهای migration که prod می‌گیرد. (جزئیات به تیکت ۱۱.)
- نکتهٔ مصرف: تست‌ها فقط لوکال‌اند → هیچ مصرفی از سقف Turso و هیچ وابستگی شبکه‌ای در CI.

### 5.3 پاریتی schema لوکال/ریموت

- **دیاlect یکی است** (libSQL/SQLite) و همان درایور → پاریتی بالاست. تفاوت‌های مستندشده:
  - **PRAGMAها:** روی Turso Cloud `busy_timeout` و `journal_mode` «Not supported» و `user_version`/`application_id` فقط خواندنی‌اند ([cloud/limitations](https://docs.turso.tech/cloud/limitations)، 2026-09-06). پس: `VACUUM` هم روی Turso غیرفعال است (usage-and-billing).
  - **کلید خارجی:** «Foreign key enforcement is off by default for SQLite compatibility» ([sql-reference/pragmas](https://docs.turso.tech/sql-reference/pragmas))؛ همان صفحه `foreign_keys` را settable هم می‌گوید — تعارض ظاهری با صفحهٔ limitations که آن را لیست نکرده؛ **عدم قطعیت: رفتار enforcement روی Cloud باید در setup واقعی تست شود** (`PRAGMA foreign_keys=ON` روی یک connection نمونه). نتیجهٔ عملی: قواعد حیاتی دامنه (منع حذف دستهٔ دارای خرج — تصمیم تیکت ۰۵) باید در لایهٔ اپ/تراکنش تضمین شوند، و FKها فقط تور امنیتیِ مکمل‌اند.
  - **timestamps/تاریخ‌ها:** تصمیم map.md — تاریخ‌ها به‌صورت رشتهٔ میلادی `YYYY-MM-DD` و مبالغ صحیح تومان؛ یعنی هیچ quirk تایم‌استمپ SQLite (تفسیر timezone) در مسیر ما نیست. اگر جایی نیاز به timestamp شد: TEXT ISO-8601 UTC ذخیره شود، نه عدد/`CURRENT_TIMESTAMP` پنهان.
  - فقط رشتهٔ `date-only` و integer → مقایسهٔ sortable و پاریتی کامل بین لوکال/ریموت.

## 6. قفل‌شدگی و مسیر خروج

- **اکسپورت رسمی به SQLite معمولی:** `turso db export <db> --output-file backup.db` → «Export a database snapshot from Turso to a SQLite file»؛ مستندات هشدار می‌دهد snapshot ممکن است آخرین تغییرات را نداشته باشد و sync با SDK را توصیه می‌کند ([cli/db/export](https://docs.turso.tech/cli/db/export)). مسیر متنی: `turso db shell <db> .dump > dump.sql` (همان صفحهٔ local-development). برگشت هم هست: `turso db import file.db` (با آماده‌سازی WAL) و Platform API upload ([cloud/migrate-to-turso](https://docs.turso.tech/cloud/migrate-to-turso)).
- **Embedded replica به‌عنوان حاشیهٔ امنیت:** اگر خواستیم، یک فرایند همیشه‌روشن (ماشین توسعه یا هر VPS با دیسک) با `url: file:replica.db` + `syncUrl` + `syncInterval` عملاً یک نسخهٔ SQLite به‌روز از همهٔ داده نگه می‌دارد؛ در بدترین حالت url را به همان فایل (یا هر هاست SQLite-سازگار) تغییر می‌دهیم. فایل خروجی استاندارد SQLite است → با `sqlite3`، better-sqlite3، libsql و ابزارهای ETL قابل خواندن.
- **PITR:** پلن Free فقط 1 روز point-in-time restore دارد → بکاپ منظم دوره‌ای با `turso db export` (مثلاً weekly در dev) را در روتین بگنجانیم.
- **مهاجرت فرضی به Postgres:** برای این دامنهٔ کوچک متوسط است: بازنویسی schema از `sqlite-core` به `pg-core` (نوع‌ها: integer→int/bigint، text→text، …)، تولید مجدد migrationها، چک کوئری‌های SQL خام (اگر باشد) و `ON CONFLICT`/AUTOINCREMENT→identity. لایهٔ query-builder درایو Drizzle تقریباً یکسان port می‌شود؛ REST API و فرانت دست‌نخورده. ریسک واقعی فقط قواعد SQLite-خاص (PRAGMA/extension/vector) است که ما استفاده نمی‌کنیم.

## 7. پیکربندی نهایی per-context

| context | TURSO_DATABASE_URL | TURSO_AUTH_TOKEN | درایور | نکته |
|---|---|---|---|---|
| dev | `file:./local.db` | — (نمی‌گذاریم) | `@libsql/client` (node) | فایل در `.gitignore`؛ `drizzle-kit push` برای ایست سریع |
| test (integration) | `file:` فایل temp per-run | — | همان | migration با `migrator`؛ بدون شبکه |
| prod (Vercel) | `libsql://<db>-<org>.turso.io` | database token (`turso db tokens create`) | همان + runtime Node | env varهای Vercel؛ migrate طبق بخش ۴.۳ |

پکیج‌ها: `pnpm add drizzle-orm @libsql/client` و `pnpm add -D drizzle-kit` + `dotenv`. اسکریپت‌ها: `db:generate`, `db:migrate`, `db:studio` (+ `db:push` برای لوکال).

```ts
// src/db/schema.ts (طرح — جزئیات در تیکت ۰۵/۱۲)
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(), // uuid
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
});

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  amount: integer('amount').notNull(), // صحیح تومان
  date: text('date').notNull(), // 'YYYY-MM-DD' میلادی date-only
  monthKey: text('month_key').notNull(), // '1405-06' جلالی — محاسبه‌شده در اپ
});
```

```ts
// src/db/index.ts — همان singleton بخش ۳.۴
```

```ts
// src/app/api/… استفاده:
import { db } from '@/db';
import { expenses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const rows = await db
  .select()
  .from(expenses)
  .where(and(eq(expenses.userId, userId), eq(expenses.monthKey, '1405-06')));
```

## 8. منابع (همه با تاریخ دسترسی 2026-09-06)

- پلن‌ها و سقف‌ها و FAQ: [turso.tech/pricing](https://turso.tech/pricing) (شامل JSON-LD پاسخ‌های FAQ)؛ [help/usage-and-billing](https://docs.turso.tech/help/usage-and-billing)
- پلتفرم: [turso-cloud](https://docs.turso.tech/turso-cloud)، [cloud/limitations](https://docs.turso.tech/cloud/limitations)، [local-development](https://docs.turso.tech/local-development)، [cli/group/unarchive](https://docs.turso.tech/cli/group/unarchive)
- ریجن/توکن: [region.turso.io](https://region.turso.io) (تست زندهٔ ما)، [api-reference/locations/list](https://docs.turso.tech/api-reference/locations/list)، [cli/db/locations](https://docs.turso.tech/cli/db/locations)، [cli/auth/api-tokens/mint](https://docs.turso.tech/cli/auth/api-tokens/mint)، [api-reference/tokens/create](https://docs.turso.tech/api-reference/tokens/create)، [cli/db/tokens/create](https://docs.turso.tech/cli/db/tokens/create)، [sdk/authentication](https://docs.turso.tech/sdk/authentication)، [sdk/authorization](https://docs.turso.tech/sdk/authorization)
- SDK/JS و in-process: [sdk/ts/quickstart](https://docs.turso.tech/sdk/ts/quickstart)، [sdk/ts/reference](https://docs.turso.tech/sdk/ts/reference)، [connect/javascript](https://docs.turso.tech/connect/javascript)
- Embedded replica و Vercel: [features/embedded-replicas/introduction](https://docs.turso.tech/features/embedded-replicas/introduction)، [integrations/vercel](https://docs.turso.tech/integrations/vercel)
- Drizzle (از مخزن رسمی مستندات، شاخهٔ main): get-started/turso-new.mdx، sqlite/connect-turso.mdx، sqlite/connect-turso-database.mdx، sqlite/connect-turso-serverless.mdx، sqlite/connect-turso-sync.mdx، sqlite/migrations.mdx، mdx/LibsqlTable.mdx، mdx/get-started/sqlite/ApplyChanges.mdx — [github.com/drizzle-team/drizzle-orm-docs](https://github.com/drizzle-team/drizzle-orm-docs)
- استارتر رسمی Next.js + Turso + Drizzle: [github.com/tursodatabase/nextjs-turso-starter](https://github.com/tursodatabase/nextjs-turso-starter) (db/index.ts، drizzle.config.ts، package.json، README)
- npm registry: `npm view drizzle-orm / drizzle-kit / @libsql/client / libsql / @libsql/win32-x64-msvc / @tursodatabase/database` (2026-09-06)
- پرچم‌های SQL: [sql-reference/pragmas](https://docs.turso.tech/sql-reference/pragmas)، [sql-reference/compatibility](https://docs.turso.tech/sql-reference/compatibility)
- خروج/ورود: [cli/db/export](https://docs.turso.tech/cli/db/export)، [cli/db/import](https://docs.turso.tech/cli/db/import)، [cloud/migrate-to-turso](https://docs.turso.tech/cloud/migrate-to-turso)

**مواردی که از منبع اولیه قابل تأیید نبود (صریحاً عدم قطعیت):** فهرست کامل و فعلی locationهای Turso (فقط `aws-*` تأیید شد؛ فهرست با `turso db locations --show-latencies` چک شود)، پیش‌فرض expiry توکن‌ها (در هر دو نوع مستند نشده)، رفتار enforcement کلید خارجی روی Turso Cloud (تعارض/ابهام بین دو صفحهٔ مستندات)، و هرگونه سیاست رسمی دربارهٔ دسترسی از ایران (هیچ بندی پیدا نشد؛ ریسک ثبت شد، نه واقعیت).
