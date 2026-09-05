# پژوهش: Dexie + vite-plugin-pwa + outbox برای لایهٔ آفلاین apps/web

تاریخ پژوهش: 2026-09-06. نسخه‌ها مستقیماً از npm registry و مستندات رسمی (dexie.org، vite-pwa-org.netlify.app، tanstack.com، MDN، better-auth.com) استخراج شده‌اند.

## TL;DR — توصیه‌ها

1. **تقسیم state: «Dexie منبع حقیقت دادهٔ اپ، TanStack Query فقط کش دادهٔ صرفاً سروری».** خرج‌ها/دسته‌ها هرگز به `useQuery` نمی‌روند؛ UI آن‌ها را با `useLiveQuery` از Dexie می‌خواند. نوشتن = نوشتن در Dexie (+ درج op در outbox در همان تراکنش) — یعنی optimistic بودن UI رایگان است و «جنگ» میان دو لایه اصلاً شکل نمی‌گیرد چون هر داده دقیقاً یک owner دارد.
2. **اسکیمای آمادهٔ outbox:** کلید اصلی هر رکورد = UUIDv7 سمت‌کلاینت (`uuid.v7()`)، `updatedAt` (epoch ms) مبنای LWW، پرچم `synced`، و جدول `outboxOps` (opId = کلید idempotency برای `POST /api/sync` طبق تصمیم تیکت 03/05). نوشتن entity + op باید در یک `db.transaction('rw', ...)` باشد.
3. **حلقهٔ سینک را خودِ اپ بنویسید (رویداد `online` + `visibilitychange` + تایمر)، نه Background Sync API** — آن API فقط Chromium است و Baseline نیست (MDN). در `POST /api/sync` هم push (ops صف) و هم pull (cursor) انجام می‌شود؛ opId کلید dedup سمت سرور.
4. **vite-plugin-pwa با `generateSW`** (نه injectManifest) + `registerType: 'prompt'` + `navigateFallback: 'index.html'` با `navigateFallbackDenylist: [/^\/api\//]`. برای SPA ما هیچ منطق سفارشی SW لازم نیست؛ injectManifest فقط برای SW دست‌نویس (مثل صف workbox در SW یا push) است.
5. **یک رویکرد واحد برای کش: «فقط Dexie» — هیچ runtime caching برای `/api` تعریف نکنید.** SW فقط app shell را precache می‌کند؛ پاسخ‌های API هرگز در Cache Storage کش نمی‌شوند تا دو منبع منقضی‌شدنی همزمان نداشته باشیم.
6. **سشن:** better-auth کوکی httpOnly دارد — مرورگر خودش می‌فرستد و JS به آن دسترسی ندارد (که خوب است؛ توکن را هیچ‌وقت در IndexedDB نریزید). برای آفلاین، پروفایل مینیمال کاربر را در Dexie نگه دارید و «سشنِ آفلاین» را صرفاً با کوکی و پروفایل کش‌شده هندل کنید؛ 401 هنگام سینک = خروج لوکال + لاگین مجدد.

## 1. نسخه‌های فعلی (2026-09-06)

| پکیج | نسخه | نکته | منبع |
|---|---|---|---|
| dexie | 4.4.5 | خط 4.x پایدار | [npm](https://registry.npmjs.org/dexie/latest) |
| dexie-react-hooks | 4.4.0 | `useLiveQuery` + `liveQuery` | [npm](https://registry.npmjs.org/dexie-react-hooks/latest) |
| vite-plugin-pwa | 1.3.0 | peerDeps: Vite `^3.1.0 || … || ^7.0.0 || ^8.0.0`، workbox 7.4.1 — با Vite 7 (برنامهٔ ما) و 8 سازگار | [npm](https://registry.npmjs.org/vite-plugin-pwa/latest) |
| @tanstack/react-query | 5.102.8 | v5 پایدار | [npm](https://registry.npmjs.org/@tanstack/react-query/latest) |
| uuid | 14.0.2 | `uuid.v7()` موجود؛ از uuid@12 فرمت ESM-only (بدون CJS) | [GitHub uuid](https://github.com/uuidjs/uuid) |
| vite / react | 8.2.2 / 19.2.8 | اگر روی Vite 7 بمانیم هم پشتیبانی کامل است | [npm](https://registry.npmjs.org/vite/latest) |

## 2. تقسیم state بین Dexie live query و TanStack Query

- `useLiveQuery(querier, deps?, defaultResult?)` یک observable واقعی است، نه polling: هر تغییری در جدول‌های دخیل در query (حتی از تب/پنجره/worker دیگر) بلافاصله re-render می‌کند؛ تا اولین نتیجه `undefined` برمی‌گرداند (مگر `defaultResult` بدهید). ([docs dexie-react-hooks](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()))
- نقش‌ها در apps/web:
  - **Dexie (منبع حقیقت):** expenses، categories (شامل یادگیری انتساب‌ها)، پروفایل مینیمال کاربر، تنظیمات، outbox. همهٔ CRUD همین‌جا می‌نویسد.
  - **TanStack Query (کش سروریِ ناپایدار):** چیزهایی که لازم نیست آفلاین باشند و آفلاین بودنشان هم معنا ندارد — مثل چک نسخهٔ deployment یا آمار سروری. اگر خواستید با `queryFn` از IndexedDB بخوانید، باید `networkMode: 'always'` بدهید وگرنه Query آفلاین اصلاً اجرا نمی‌شود (`fetchStatus: 'paused'`)؛ مستندات رسمی دقیقاً مثال storage محلی را به‌عنوان کاربرد `always` ذکر می‌کند. ([Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode))
- **الگوی بدون تنش:** sync loop (بخش 4) دادهٔ سرور را می‌نویسد → Dexie → `useLiveQuery` خودکار رندر می‌شود. یعنی نه `invalidateQueries` برای دادهٔ اپ لازم است نه optimistic mutation.
- **چرا persistQueryClient جایگزین Dexie برای دادهٔ اصلی نمی‌شود:** snapshot سریال‌شده با `maxAge` پیش‌فرض 24 ساعت است، `gcTime` باید از آن بزرگ‌تر باشد، بعد از reload برای resume کردن mutation ها `defaultMutationFn` لازم است و نیاز به `queryClient.resumePausedMutations()` در `onSuccess` دارد. ([persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)، [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)) برای bootstrap سشن/تنظیمات سبک قابل‌قبول است؛ برای دادهٔ اپ حذفش کنید.

## 3. اسکیمای لوکال آمادهٔ outbox

```ts
// apps/web/src/local/db.ts
import Dexie, { type Table } from "dexie";

export interface Expense {
  id: string;              // uuid.v7() — تولید در کلاینت، هرگز از سرور نمی‌آید
  userId: string;
  categoryId: string;
  amount: number;          // تومان، عدد صحیح
  occurredAt: string;      // ISO میلادی (نمایش جلالی فقط در UI)
  note?: string;
  createdAt: number;       // epoch ms
  updatedAt: number;       // epoch ms — مبنای LWW
  deleted: 0 | 1;          // tombstone — حذف نرم تا سینک
  synced: 0 | 1;           // 0 = dirty در صف (شاخص‌گذاری‌شده برای بج «در صف»)
}

export interface Category {
  id: string;              // uuid.v7()
  name: string;
  order: number;
  hidden: 0 | 1;
  updatedAt: number;
  deleted: 0 | 1;
  synced: 0 | 1;
}

export interface OutboxOp {
  opId: string;            // uuid.v7 — idempotency key سمت سرور
  table: "expenses" | "categories";
  type: "put" | "delete";
  data: unknown;           // snapshot رکورد در لحظهٔ op
  createdAt: number;       // ترتیب پخش
  attempts: number;
  lastError?: string;
}

class SpendDB extends Dexie {
  expenses!: Table<Expense, string>;
  categories!: Table<Category, string>;
  outboxOps!: Table<OutboxOp, string>;
  appState!: Table<{ key: string; value: unknown }, string>; // پروفایل/تنظیمات
  constructor() {
    super("spend-tracker");
    this.version(1).stores({
      expenses: "id, userId, [userId+occurredAt], categoryId, synced",
      categories: "id, hidden, synced",
      outboxOps: "opId, createdAt",
      appState: "key",
    });
  }
}
export const db = new SpendDB();
```

نکات کلیدی:

- **UUIDv7** (RFC 9562، مه 2024): 48 بیت timestamp میلی‌ثانیه‌ای + 74 بیت تصادفی؛ به‌صورت opaque bytes مرتب‌زمانی است → locality بهتر برای کلید IndexedDB. `crypto.randomUUID()` فقط v4 می‌دهد؛ v7 را از پکیج `uuid` بگیرید. ([RFC 9562](https://www.rfc-editor.org/rfc/rfc9562.html)، [uuid README](https://github.com/uuidjs/uuid))
- **تولید id قبل از نوشتن** یعنی روند آفلاین: ثبت → فوراً در UI دیده می‌شود → بعداً idempotently به سرور push می‌شود. سرور با opId دوباره‌کاری را می‌بلعد (تصمیم تیکت 03).
- **هشدار LWW:** `updatedAt` بر ساعت دستگاه کاربر است؛ ساعتِ منحرف یعنی رکورد قدیمی ممکن است ببرد. سمت سرور می‌تواند `serverReceivedAt` را به‌عنوان تساوی‌شکن کنار `updatedAt` نگه دارد (جزئیات در تیکت 05).
- **یک تراکنش برای write + enqueue:** Dexie اجازه نمی‌دهد داخل `transaction` روی promise خارجی (مثل fetch) await کنید — commit خودکار به‌هم می‌ریزد. پس fetch را بیرون تراکنش نگه دارید و فقط نوشتن‌های Dexie را داخلش بگذارید. ([Dexie.transaction](https://dexie.org/docs/Dexie/Dexie.transaction()))

```ts
export async function saveExpense(e: Expense) {
  await db.transaction("rw", [db.expenses, db.outboxOps], async () => {
    await db.expenses.put(e);
    await db.outboxOps.add({
      opId: uuid.v7(), table: "expenses", type: "put",
      data: e, createdAt: Date.now(), attempts: 0,
    });
  });
}
```

## 4. حلقهٔ سینک (push + pull در یک endpoint)

```ts
let syncing = false;
export async function flushOutbox() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    let cursor = await getCursor(); // آخرین pull cursor
    while (true) {
      const ops = await db.outboxOps.orderBy("createdAt").limit(50).toArray();
      const res = await fetch("/api/sync", {
        method: "POST",
        body: JSON.stringify({ ops, cursor }),
      });
      if (res.status === 401) { onAuthLost(); return; }      // سشن منقضی
      if (!res.ok) throw new Error(`sync failed: ${res.status}`);
      const { acks, changes, nextCursor } = await res.json();
      await applyServerChanges(changes, nextCursor);          // upsert LWW + حذف ack شده‌ها
      cursor = nextCursor;
      if (ops.length < 50 && !changes.length) break;          // صف خالی شد
    }
  } catch (err) {
    scheduleRetry(); // backoff نمایی؛ فلگ syncing آزاد می‌شود
  } finally {
    syncing = false;
  }
}

window.addEventListener("online", flushOutbox);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") flushOutbox();
});
setInterval(flushOutbox, 30_000); // شبکه‌های نیمه‌سالم (online اما فیلترشده)
```

- **چرا حلقهٔ دستی:** Background Sync API فقط در Chromium کار می‌کند و MDN آن را «Limited availability / Not Baseline» برچسب زده؛ workbox هم در مرورگرهای بدون آن، صف IndexedDB را فقط هنگام startup مجدد SW پخش می‌کند و تا صفحه باز است. پس این API به‌عنوان بهینه‌سازی اختیاری است، نه تکیه‌گاه صحت. ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)، [workbox-background-sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync))
- **صف سمت اپ (Dexie) فقط یکی است.** اگر در SW هم `backgroundSync`/Queue راه بیندازید، دو صف موازی خواهید داشت — نکنید. صحت با صف Dexie + endpoint دسته‌ای تضمین می‌شود.
- خطای 4xx (validation) یعنی op قابل‌پخش نیست: op را park کنید (`attempts` زیاد + `lastError`) و در UI نشان دهید؛ 5xx/شبکه = retry با backoff.
- ترتیب: ops را با `createdAt` صعودی بفرستید؛ اگرچه LWW سمت سرور به `updatedAt` رکورد است و ترتیب عملیات‌ها را بی‌اثر می‌کند (قرارداد تیکت 05).

## 5. vite-plugin-pwa برای SPA اپ‌شِل

```ts
// vite.config.ts
VitePWA({
  registerType: "prompt",
  includeAssets: ["favicon.svg"],
  manifest: { /* name, short_name, dir: "rtl", lang: "fa", display: "standalone", theme_color… */ },
  workbox: {
    navigateFallback: "index.html",          // همهٔ navigation ها → app shell
    navigateFallbackDenylist: [/^\/api\//],  // API را شامل fallback نکن
    cleanupOutdatedCaches: true,
    globPatterns: ["**/*.{js,css,html,svg,woff2}"], // فونت Vazirmatn را self-host کنید تا precache شود
  },
  devOptions: { enabled: true, type: "module" },
})
```

- **generateSW در برابر injectManifest:** generateSW کل SW را با workbox-build می‌سازد (پیش‌فرض پلاگین)؛ injectManifest فقط precache manifest را در SW دست‌نویس شما تزریق می‌کند. قواعد docs: دست‌نویس را فقط وقتی بخواهید که SW را خودتان بنویسید (routing سفارشی، صف workbox در SW، push، ...). اپ ما هیچ‌کدام را لازم ندارد → **generateSW**. ([Service Worker Strategies](https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors)، [injectManifest](https://vite-pwa-org.netlify.app/guide/inject-manifest.html))
- **registerType: `prompt` به‌جای `autoUpdate`:** با autoUpdate به‌روزرسانی بی‌صدا رخ می‌دهد و «کاربر فقط reload صفحه‌اش را می‌بیند» — وسط ثبت خرج صفحه نصفه می‌ماند. با `prompt` خود کاربر تصمیم می‌گیرد؛ docs همین «جلوگیری از از دست رفتن فرم در حال پر شدن» را دلیل می‌آورد. ([Prompt for update](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html))
- **UX آپدیت با React:** ماژول `virtual:pwa-register/react` → `useRegisterSW({ onRegistered, onRegisterError })` که `{ offlineReady, needRefresh, updateServiceWorker }` برمی‌گرداند؛ Toast (به سبک ReloadPrompt.tsx نمونهٔ docs، ولی RTL فارسی) نشان «نسخهٔ جدید آماده است → بارگذاری مجدد» بدهید. برای چک دوره‌ای، در `onRegistered` یک `setInterval` روی `r?.update()` (مثلاً ساعتی) بگذارید. ([React integration](https://vite-pwa-org.netlify.app/frameworks/react.html))
- **رفتار آفلاین SPA:** با precache + `navigateFallback: "index.html"`، باز شدن از هوم‌اسکرین در حالت آفلاین همیشه app shell را می‌دهد و router داخلی مسیر را می‌گیرد. مسیرهای denylist شده از SW خارج می‌شوند و آفلاین «No internet» می‌بینند — به همین دلیل `/api` را حتماً denylist کنید (برخورد navigation با API نداریم ولی از روز اول دفاعی باشد). ([generateSW docs](https://vite-pwa-org.netlify.app/workbox/generate-sw.html))
- **Dev mode:** `devOptions: { enabled: true, type: "module" }` از v0.11.13 SW را در توسعه هم ثبت می‌کند؛ برای روزمره خاموش نگهش دارید (فقط هنگام تست رفتار PWA روشن کنید) چون کش SW می‌تواند با HMR قاطی شود. ([Development](https://vite-pwa-org.netlify.app/guide/development.md))

## 6. کش API: توصیهٔ واحد — «فقط Dexie»

| گزینه | ارزیابی |
|---|---|
| A. runtimeCaching (NetworkFirst) برای `/api` + کش query | رد: سه کپی از یک داده (Cache Storage، IndexedDB، query cache) با سه چرخهٔ منقضی شدن؛ ریسک ناسازگاری و رگرسیون سخت |
| B. **بدون کش `/api` در SW؛ sync loop → Dexie → liveQuery** | **توصیه:** منبع حقیقت واحد، رفتار کاملاً قطعی آفلاین، live query واکنشی رایگان |
| C. persistQueryClient در IndexedDB | رد برای دادهٔ اصلی (snapshot با maxAge 24h و resume موتوری متفاوت — بخش 2)؛ برای bootstrap سشن قابل‌قبول |

دلایل B برای قرارداد ما: (1) تعامل با سرور فقط `POST /api/sync` دسته‌ای است — پاسخش ack/cursor است، اصلاً GET کش‌پذیر نداریم؛ (2) داده باید بی‌نهایت آفلاین بماند، درحالی‌که runtimeCaching فقط expiration/maxEntries دارد و هیچ API واکنشی به UI نمی‌دهد؛ (3) Dexie versioning/migration برای تحول اسکیما داریم، Cache Storage ندارد. اگر بعداً GET واقعی اضافه شد (مثلاً نرخ ارز)، آن را هم mirror در Dexie کنید تا الگو نشکند؛ تنها runtime caching مجاز: فونت/CDN بیرونی با `CacheFirst` (نمونهٔ fonts در docs).

## 7. سشن و توکن در آفلاین

- better-auth سشن را با کوکی httpOnly مدیریت می‌کند و `authClient`/`fetch` مرورگر خودش آن را ضمیمه می‌کند؛ TTL پیش‌فرض 7 روز با تمدید sliding. گزینهٔ `cookieCache` فقط برای کاهش کوئری سشن روی سرور است و در آفلاین نقشی ندارد. ([Session Management](https://www.better-auth.com/docs/concepts/session-management))
- **چیزی برای کش کردن نیست و نباید باشد:** توکن سشن (کوکی httpOnly) از JS قابل‌خواندن نیست — این را دور نزنید (XSS). فقط یک رکورد پروفایل مینیمال (userId، name، email) را هنگام لاگین در `appState` بگذارید.
- رفتار آفلاین: بوت اپ با پروفایل کش‌شده → کامل کار می‌کند؛ اعتبار سشن را نمی‌شود آفلاین چک کرد → تا اولین سینک موفق «به‌اصطلاح لاگین» بمانید. 401 در سینک = خروج لوکال (حذف پروفایل؛ داده‌های در صف کاربر بمانند تا لاگین مجدد همان کاربر) + هدایت به لاگین.
- خروج آفلاین: کوکی سشن پاک می‌شود (logout سمت کلاینت)؛ پیاده‌سازی `signOut` آفلاین یعنی فقط پاکسازی لوکال — سینک خروج بعداً انجام می‌شود.

## 8. Gotchas

- `useLiveQuery` در رندر اول `undefined` می‌دهد → حالت loading را هندل کنید؛ کوئری‌ها را باریک بنویسید (هر تغییری در جدول‌های همان کوئری re-render می‌دهد).
- `crypto.randomUUID()` = v4؛ برای v7 پکیج `uuid` (uuid@14) لازم است.
- داخل `db.transaction` روی fetch/promise خارجی await نکنید — commit تراکنش به‌هم می‌ریزد.
- `workbox.backgroundSync.maxRetentionTime` برحسب **دقیقه** است (اگر روزی injectManifest گرفتید) — و به هر حال صف دوم نمی‌خواهیم.
- بعد از تغییر SW با `registerType: 'prompt'`، SW جدید تا confirm کاربر فعال نمی‌شود؛ دکمهٔ reload در toast باید `updateServiceWorker(true)` را صدا بزند.
- `navigateFallback` فقط برای navigation request هاست؛ asset های گمشده را precache ناقص درمان می‌کند — `globPatterns` را برای فونت‌های self-host شده کامل کنید.
- IndexedDB در حالت private browsing برخی مرورگرها fail می‌شود → خطای `db.open()` را گرفته و پیام مناسب بدهید.

## منابع

- Dexie: [useLiveQuery](https://dexie.org/docs/dexie-react-hooks/useLiveQuery()) · [Dexie.transaction](https://dexie.org/docs/Dexie/Dexie.transaction())
- TanStack Query v5: [Network Mode](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode) · [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) · [persistQueryClient](https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient)
- vite-plugin-pwa 1.3.0: [Getting Started](https://vite-pwa-org.netlify.app/guide/) · [Strategies & Behaviors](https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors) · [generateSW](https://vite-pwa-org.netlify.app/workbox/generate-sw.html) · [injectManifest](https://vite-pwa-org.netlify.app/guide/inject-manifest.html) · [Prompt for update](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html) · [React](https://vite-pwa-org.netlify.app/frameworks/react.html) · [Development](https://vite-pwa-org.netlify.app/guide/development.md)
- پلتفرم: [MDN Background Synchronization](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API) · [workbox-background-sync](https://developer.chrome.com/docs/workbox/modules/workbox-background-sync) · [RFC 9562 (UUIDv7)](https://www.rfc-editor.org/rfc/rfc9562.html) · [uuid](https://github.com/uuidjs/uuid)
- Auth: [better-auth Session Management](https://www.better-auth.com/docs/concepts/session-management)
