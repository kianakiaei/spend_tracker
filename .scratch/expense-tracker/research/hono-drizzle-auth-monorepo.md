# پژوهش: اسکفولد بک‌اند مونوریپو — Hono + Drizzle + better-auth (+ انتخاب runtime)

تاریخ پژوهش: 2026-09-06. همه نسخه‌ها مستقیماً از npm registry و مستندات رسمی در همین تاریخ استخراج شده‌اند.

## TL;DR — توصیه‌ها

1. **Runtime: Node.js 24 (LTS) + better-sqlite3.** Bun 1.4.2 روی ویندوز امروز واقعاً قابل‌استفاده است (dev/test خوب است)، ولی برای این پروژه Node انتخاب امن‌تر و بی‌دردسرتر است — دلایل در بخش بعد. کد را طوری بنویسید که آداپتور DB در یک فایل isolated باشد تا مهاجرت بعدی به Bun (در صورت تمایل) فقط تغییر یک import باشد.
2. **Stack در apps/api:** hono 4.13.x + drizzle-orm 0.45.x (درایور better-sqlite3) + drizzle-kit 0.31.x برای migration + @hono/zod-validator 0.9.x + better-auth 1.7.x با آداپتور Drizzle.
3. **RPC تایپ‌سیف:** `AppType` را از زنجیره route های apps/api صادر کنید و در apps/web با `hc<AppType>()` مصرف کنید؛ `packages/shared` فقط اسکیمای Zod مشترک را نگه می‌دارد.
4. **Auth:** better-auth + آداپتور `@better-auth/drizzle-adapter` با `provider: "sqlite"`؛ جداول auth با CLI به‌صورت فایل Drizzle schema تولید می‌شوند.
5. **سینک:** یک endpoint دسته‌ای `POST /api/sync` (push+pull در یک رفت‌وبرگشت)، cursor سمت‌سرور، tombstone، upsert شرطی برای LWW — جزئیات در بخش 5.

## 1. نسخه‌های فعلی (2026-09-06)

| پکیج / ابزار | نسخه | منبع |
|---|---|---|
| Bun | 1.4.2 (2026-09-05) | [bun.com](https://bun.com/), [GitHub releases](https://github.com/oven-sh/bun/releases) |
| Node.js | 24.x (Active LTS؛ از اکتبر 2025 LTS شده) | nodejs.org |
| hono | 4.13.7 | [npm](https://registry.npmjs.org/hono/latest) |
| @hono/node-server | 2.1.1 | [npm](https://registry.npmjs.org/@hono%2Fnode-server/latest) |
| @hono/zod-validator | 0.9.1 | [npm](https://registry.npmjs.org/@hono%2Fzod-validator/latest) |
| drizzle-orm | 0.45.2 | [npm](https://registry.npmjs.org/drizzle-orm/latest) |
| drizzle-kit | 0.31.10 | [npm](https://registry.npmjs.org/drizzle-kit/latest) |
| better-auth | 1.7.2 | [npm](https://registry.npmjs.org/better-auth/latest) |
| zod | 4.5.4 | [npm](https://registry.npmjs.org/zod/latest) |
| better-sqlite3 | 13.0.3 (prebuilt برای win32-x64 و win32-arm64؛ بدون نیاز به node-gyp) | [npm](https://registry.npmjs.org/better-sqlite3/latest) |

## 2. انتخاب runtime: Bun در برابر Node + better-sqlite3

### وضعیت Bun روی ویندوز (تا 1.4.2)

- Bun 1.4 (اوت 2026): استارتاپ روی ویندوز 2.5x سریع‌تر شده (15.5ms)، باینری ۱۷٪ کوچک‌تر، build نیتیو برای Windows ARM64، پشتیبانی PTY (`Bun.Terminal`)، cron با Task Scheduler و کدساینینگ Authenticode. بیش از ۲۹۰۰ باگ نسبت به 1.3 رفع شده ([blog Bun 1.4](https://bun.com/blog/bun-v1.4)).
- `bun:sqlite` روی ویندوز به‌صورت رسمی پشتیبانی می‌شود (SQLite statically-linked، WAL و fileControl مستند شده) ([docs bun:sqlite](https://bun.com/docs/api/sqlite)).
- باقی‌مانده محدودیت‌ها: خود Bun می‌گوید «100% سازگار با Node نیست»؛ `worker_threads` با `SharedArrayBuffer`+`Atomics.wait` روی ویندوز پشتیبانی نمی‌شود؛ باگ‌های پراکنده `node:http` (مثل hang در request های بزرگ، [issue #27010](https://github.com/oven-sh/bun/issues/27010)) و باگ‌های workspace/install در سری 1.3 ([#23615](https://github.com/oven-sh/bun/issues/23615)) گزارش شده‌اند.

### مقایسه برای این پروژه

| معیار | Bun 1.4.2 + bun:sqlite | Node 24 + better-sqlite3 13 |
|---|---|---|
| نصب روی ویندوز | یک باینری، بدون کامپایل | prebuilt binary رسمی برای win32-x64/arm64 — دیگر نیازی به node-gyp/VS Build Tools نیست |
| پختگی dev/test روی ویندوز | خوب و رو به بهتر؛ گاهی باگ‌های پلتفرمی | کاملاً بالغ؛ کل اکوسیستم (pnpm, vitest, tsx, drizzle-kit) روی آن تست‌شده‌تر است |
| کارایی SQLite | bun:sqlite ادعای 3–6x سریع‌تر از better-sqlite3 دارد | برای اپ تک‌کاربره با SQLite محلی کاملاً بی‌اهمیت |
| قفل پلتفرمی | import از `bun:sqlite` کد را به Bun قفل می‌کند (اگر بعداً روی Node deploy کنید باید آداپتور عوض شود) | کد روی Node و Bun هر دو اجرا می‌شود (Bun آداپتورهای Node-API را لود می‌کند) |
| سازگاری با pnpm workspace | قابل انجام ولی ابزار سوم وارد می‌شود | بومی |

### توصیه

**Node 24 LTS + better-sqlite3.** اپ ما I/O-heavy نیست و SQLite محلی تک‌کاربره دارد؛ مزیت کارایی Bun عملاً بی‌اثر است، ولی ریسک باگ‌های پلتفرمی ویندوزی و قفل‌شدن به `bun:sqlite` هزینه واقعی دارد. ضمناً اگر به `node:sqlite` (داخلی Node ≥22.5) مهاجرت بخواهید، هم better-auth ([docs SQLite](https://www.better-auth.com/docs/adapters/sqlite)) و هم drizzle-orm ([get-started SQLite](https://orm.drizzle.team/docs/get-started-sqlite)) آن را پشتیبانی می‌کنند — یعنی مسیر zero-dependency هم باز است. اگر روزی deploy فقط و فقط Bun باشد، تغییر آداپتور DB (یک فایل) کافی است.

## 3. اسکفولد pnpm workspace

ساختار:

```
apps/api      → Hono + Drizzle + better-auth (دیتابیس SQLite فایل)
apps/web      → Vite SPA
packages/shared → اسکیمای Zod مشترک (zod 4) — تک منبع حقیقت validation
```

`pnpm-workspace.yaml`: `packages: ["apps/*", "packages/*"]`

### packages/shared (Zod 4)

```ts
// packages/shared/src/schemas.ts
import { z } from "zod";

export const ExpenseCreateSchema = z.object({
  amount: z.number().int(),            // ریال، واحد پولِ صحیح — هرگز float
  title: z.string().min(1).max(200),
  occurredAt: z.string(),              // ISO date (نمایش شمسی فقط در UI)
});
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;
```

### apps/api — دیتابیس و migration

```ts
// apps/api/src/db/index.ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database(process.env.DB_FILE_NAME!);
sqlite.pragma("journal_mode = WAL");
export const db = drizzle({ client: sqlite, schema });
```

```ts
// apps/api/drizzle.config.ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DB_FILE_NAME! },
});
```

جریان migration: `npx @better-auth/cli@latest generate --output src/db/auth-schema.ts` (تولید جداول auth به‌صورت Drizzle schema) → جداول دامنه را دستی در `schema.ts` می‌نویسید و `auth-schema` را re-export می‌کنید → `pnpm drizzle-kit generate` و `pnpm drizzle-kit migrate` ([docs drizzle-kit](https://orm.drizzle.team/docs/drizzle-kit-generate)). برای اعمال خودکار موقع بوت: `migrate()` از `drizzle-orm/better-sqlite3/migrator`.

### apps/api — مسیرها، validation و خروجی AppType

```ts
// apps/api/src/app.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { ExpenseCreateSchema } from "@spend/shared/schemas";
import { sessionMiddleware } from "./auth";

const expenses = new Hono()
  .use("*", sessionMiddleware)
  .get("/", async (c) => c.json({ items: await listExpenses(c.env.userId) }))
  .post("/", zValidator("json", ExpenseCreateSchema), async (c) => {
    const body = c.req.valid("json"); // تایپ‌شده از اسکیمای Zod
    return c.json({ item: await createExpense(c.env.userId, body) }, 201);
  });

const app = new Hono()
  .basePath("/api")
  .route("/expenses", expenses);

export type AppType = typeof app; // کلید RPC تایپ‌سیف
export default app;
```

```ts
// apps/api/src/server.ts
import { serve } from "@hono/node-server";
import app from "./app";
serve({ fetch: app.fetch, port: 8787 });
```

نکته `@hono/zod-validator`: امضای `zValidator(target, schema, hook?, options?)` با target از نوع `'json' | 'query' | 'param' | 'header' | 'form'`؛ خطای پیش‌فرض 400 می‌دهد و با hook سوم می‌توانید `HTTPException(400, { cause: result.error })` پرتاب کنید تا پاسخ خطای یکدست داشته باشید ([README](https://github.com/honojs/middleware/tree/main/packages/zod-validator)).

### apps/web — مصرف با hc (بدون کلاینت دستی)

```ts
// apps/web/src/api.ts
import { hc } from "hono/client";
import type { AppType } from "apps-api/app"; // یا از طریق workspace dependency

export const client = hc<AppType>("/api", {
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});
// client.expenses.$get()، client.expenses.$post({ json: {...} })
```

**Gotchaهای رسمی `hc`** ([Hono RPC guide](https://hono.dev/docs/guides/rpc)):

- در tsconfig هر دو سمت `"strict": true` باشد و **نسخه hono در مونوریپو یکسان** باشد وگرنه خطای «Type instantiation is excessively deep» می‌گیرید (با pnpm hoisting خودکار یک نسخه می‌ماند).
- هرگز `c.notFound()` برنگردانید — تایپ آن به کلاینت infer نمی‌شود؛ همیشه `c.json({...}, 404)`.
- param و query همیشه `string` پاس داده می‌شوند و `hc` خودش URL-encode نمی‌کند.
- پاسخ `app.onError` infer نمی‌شود؛ خطاهای سراسری را با تایپ دستی merge کنید.
- برای سرعت tsserver در تعداد route بالا: `export type Client = ReturnType<typeof hc<typeof app>>` و یک `hcWithType` از پیش‌ساخته.

## 4. better-auth + Hono روی SQLite/Drizzle

نسخه فعلی: **1.7.2**. آداپتور Drizzle در پکیج مستقل [`@better-auth/drizzle-adapter`](https://www.better-auth.com/docs/adapters/drizzle) است (از خط 1.5 به بعد پکیج‌ها تفکیک شده‌اند؛ راهنمای قدیمیِ `better-auth/adapters/drizzle` را در بلاگ‌ها ببینید).

```ts
// apps/api/src/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true },
  trustedOrigins: ["http://localhost:5173"],
});
```

نصب جداول auth: `npx @better-auth/cli@latest generate --output src/db/auth-schema.ts` → migration با drizzle-kit ([CLI docs](https://www.better-auth.com/docs/concepts/cli)). اگر اسم جدول‌هایتان جمع است، گزینه `usePlural: true` بدهید تا mapping دستی لازم نشود. برای بهبود کارایی `/get-session` (2–3x) گزینه `advanced: { database: { joins: true } }` (نیازمند تعریف `relations` در schema و v1.4+ آداپتور).

**Mount روی Hono** — چون هر دو Web Standard Request/Response هستند، آداپتور خاصی لازم نیست ([docs Hono integration](https://www.better-auth.com/docs/integrations/hono)):

```ts
app.all("/api/auth/*", (c) => auth.handler(c.req.raw)); // قبل از routeهای دیگر
```

**الگوی session middleware:**

```ts
import { createMiddleware } from "hono/factory";

export const sessionMiddleware = createMiddleware<{
  Variables: { user: typeof auth.$Infer.Session["user"] | null;
                session: typeof auth.$Infer.Session["session"] | null };
}>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  await next();
});
```

در routeهای محافظت‌شده: `const user = c.get("user"); if (!user) throw new HTTPException(401);`

**نکات:**
- سمت مرورگر برای فلوهای auth از کلاینت خود better-auth (`createAuthClient`) استفاده کنید و `hc` را فقط برای RPC دامنه؛ `hc` با `credentials: "include"` ساخته شود.
- CORS فقط اگر cross-origin هستید: `credentials: true` با origin صریح (هرگز `*`) + همان origin در `trustedOrigins`.
- روی Bun هم better-auth مستقیماً `new Database(...)` از `bun:sqlite` را قبول می‌کند — مسیر مهاجرت باز است.
- در 1.5 همه دستورات CLI زیر alias کوتاه `npx auth ...` هم اجرا می‌شوند ([بلاگ 1.5](https://better-auth.com/blog/1-5)).

## 5. طراحی endpoint سینک (ورودی تیکت «مدل داده و قرارداد سینک»)

شکل پیشنهادی: یک endpoint دسته‌ای push+pull در یک رفت‌وبرگشت (کمترین هزینه شبکه برای کلاینت آفلاین) — الگو مشابه [Contentful Sync API](https://www.contentful.com/developers/docs/concepts/sync) و [Microsoft Graph delta query](https://learn.microsoft.com/en-us/graph/delta-query-overview):

```
POST /api/sync
{ "cursor": "<سرور-صادرشده یا null>", "deviceId": "...", "changes": [ {op}... ] }
→ { "applied": [ {id, status: "applied"|"stale"|"rejected", row} ],
     "changes": [row...], "cursor": "<جدید>" }
```

**ملاحظات کلیدی:**

1. **Cursor سمت‌سرور، نه ساعت کلاینت.** cursor یک شناسه مونوتونیک change-log سمت سرور (یا snapshot از max(updatedAt) هر جدول) باشد؛ ساعت کلاینت برای pull قابل‌اعتماد نیست ([RxDB offline](https://rxdb.info/articles/offline-database.html)، [delta query](https://learn.microsoft.com/en-us/graph/delta-query-overview)).
2. **LWW با timestamp سمت‌سرور.** سرور هنگام accept، `updatedAt` نهایی را خودش می‌گذارد؛ timestamp کلاینت فقط متادیتای مقایسه اولیه است (کلاک‌های دستگاه به‌هم نمی‌خورند — [LWW implementation](https://oneuptime.com/blog/post/2026-01-30-last-write-wins/view)، [هشدار silent data loss](https://programmingappliedai.substack.com/p/how-do-we-resolve-write-conflicts)).
3. **Upsert شرطی در SQLite** (بازنده‌ی کهنه overwrite نکند):

```sql
INSERT INTO expenses (id, ..., updated_at) VALUES (?, ..., ?)
ON CONFLICT(id) DO UPDATE SET ... = excluded....
WHERE excluded.updated_at > expenses.updated_at;
```

tie-break قطعی: مقایسه `deviceId` یا uuid در تساوی timestamp.
4. **Tombstone به‌جای حذف:** ستون `deleted_at` (nullable) در همه جدول‌های syncable؛ pull شامل tombstoneهاست تا کلاینت ردیف محلی را پاک کند. حذف hard فقط garbage-collection دوره‌ای سمت سرور.
5. **Idempotency:** هر op با id تولیدشده کلاینت (UUIDv7 — قابل sort، مناسب SQLite)؛ تلاش مجدد بعد از قطعیِ وسط batch امن باشد. پاسخ per-op می‌دهید تا کلاینت دقیقاً بداند چه چیزی apply شده.
6. **اسکیمای مشترک جدول‌های syncable:** `id TEXT PK`، `user_id` (فیلتر بر اساس session)، `updated_at INTEGER` (epoch ms، UTC، سمت سرور)، `deleted_at INTEGER NULL`، `created_at`. این ستون‌ها را از الان در Drizzle schema بگذارید تا تیکت قرارداد سینک بعداً فقط contract را بنویسد.
7. **پول صفحه‌بندی‌شده:** `limit` روی changes خروجی + cursor ادامه، تا pull اولیه سنگین نشود.
8. **داده پول:** مبلغ را int جزئی (ریال) نگه دارید؛ تاریخ «وقوع خرج» (`occurredAt`، نمایش شمسی در UI) را از `updated_at` (متادیتای سینک) جدا کنید.
9. **تک‌کاربره بودن اپ:** تداخل فقط بین دستگاه‌های خود کاربر رخ می‌دهد؛ LWW روی رکورد کامل کافی است. اگر بعداً merge سطح فیلد/CRDT لازم شد، وجود op-log سمت کلاینت (outbox) مسیر ارتقا را باز نگه می‌دارد ([LWW vs CRDT](https://dzone.com/articles/conflict-resolution-using-last-write-wins-vs-crdts)، [offline-first data layer](https://developer.android.com/topic/architecture/data-layer/offline-first)).

## 6. منابع اصلی

- [Bun 1.4 blog](https://bun.com/blog/bun-v1.4) · [bun.com](https://bun.com/) · [bun:sqlite docs](https://bun.com/docs/api/sqlite) · [issue #27010](https://github.com/oven-sh/bun/issues/27010) · [issue #23615](https://github.com/oven-sh/bun/issues/23615)
- [Hono RPC guide (hc)](https://hono.dev/docs/guides/rpc) · [hono releases](https://github.com/honojs/hono/releases) · [@hono/zod-validator README](https://github.com/honojs/middleware/tree/main/packages/zod-validator)
- [Drizzle: SQLite get-started](https://orm.drizzle.team/docs/get-started-sqlite) · [connect bun-sqlite](https://orm.drizzle.team/docs/sqlite/connect-bun-sqlite) · [drizzle-kit](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [better-auth Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle) · [better-auth SQLite](https://www.better-auth.com/docs/adapters/sqlite) · [Hono integration](https://www.better-auth.com/docs/integrations/hono) · [CLI](https://www.better-auth.com/docs/concepts/cli) · [بلاگ 1.5](https://better-auth.com/blog/1-5)
- [Contentful Sync API](https://www.contentful.com/developers/docs/concepts/sync) · [MS Graph delta query](https://learn.microsoft.com/en-us/graph/delta-query-overview) · [OneUptime: LWW](https://oneuptime.com/blog/post/2026-01-30-last-write-wins/view) · [LWW vs CRDT](https://dzone.com/articles/conflict-resolution-using-last-write-wins-vs-crdts) · [Android offline-first](https://developer.android.com/topic/architecture/data-layer/offline-first) · [RxDB offline](https://rxdb.info/articles/offline-database.html)
