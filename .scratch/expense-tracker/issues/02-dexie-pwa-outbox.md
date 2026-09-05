# 02 — الگوهای Dexie + PWA + outbox برای معماری آفلاین‌فرست

Type: research
Status: resolved
Blocked by: —

## Question

برای apps/web (React + Vite + Tailwind + shadcn/ui) چه الگوها و تنظیماتی برای لایهٔ آفلاین درست است؟

- Dexie + dexie-react-hooks (live queries) در کنار TanStack Query: کدام state در Dexie می‌ماند و کدام سمت TanStack Query؟ الگوهای رایج.
- طرح جداول لوکال آمادهٔ outbox: UUID محلی، updatedAt، پرچم synced؛ صف mutation؛ حلقهٔ سینک روی رویدادهای online/offline و retry-on-reconnect.
- vite-plugin-pwa: app-shell caching، استراتژی کش برای درخواست‌های API، آپدیت service worker، سازگاری با نسخه‌های فعلی Vite/React.
- کش سشن و داده برای استفادهٔ آفلاین کامل (app shell + دادهٔ کش‌شده، صف تا اتصال مجدد).
- مقصد یافته‌ها: `.scratch/expense-tracker/research/dexie-pwa-outbox.md`

## Answer

توصیهٔ اصلی: «Dexie منبع حقیقت دادهٔ اپ، TanStack Query فقط کش دادهٔ صرفاً سروری» — UI خرج‌ها/دسته‌ها را با `useLiveQuery` از Dexie می‌خواند و هر نوشتن در یک تراکنش، رکورد (UUIDv7، `updatedAt`، tombstone، پرچم `synced`) + op مربوطه را در جدول `outboxOps` ثبت می‌کند؛ حلقهٔ سینک دستی (رویداد `online` + `visibilitychange` + تایمر) صف را با `POST /api/sync` (opId = کلید idempotency، همراه pull/cursor) تخلیه می‌کند — Background Sync API فقط Chromium است و تکیه‌گاه صحت نمی‌شود. سمت PWA: `generateSW` با `registerType: 'prompt'` (toast آپدیت با `useRegisterSW` برای حفظ فرم‌های نیمه‌کاره)، `navigateFallback: 'index.html'` با denylist برای `/api`، فونت self-host تا precache شود، و `devOptions` فقط هنگام تست. برای کش API یک رویکرد واحد: هیچ runtime caching برای `/api` نیست — sync loop داده را در Dexie می‌نویسد و liveQuery رندر می‌کند (SW فقط app shell را precache می‌کند). سشن: کوکی httpOnly better-auth دست‌نخورده می‌ماند (توکن در IndexedDB نمی‌رود)، پروفایل مینیمال در `appState` کش می‌شود و 401 هنگام سینک یعنی خروج لوکال + لاگین مجدد.

جزئیات، کدها و منابع: [research/dexie-pwa-outbox.md](../research/dexie-pwa-outbox.md)

## Comments

- 2026-09-06 — چرخش استک: کل این تصمیم باطل شد. آفلاین‌فرست، Dexie/IndexedDB، outbox، service worker و کش PWA حذف شدند (خط Out of scope نقشه). سند پژوهش فقط به‌عنوان تاریخچه می‌ماند.
