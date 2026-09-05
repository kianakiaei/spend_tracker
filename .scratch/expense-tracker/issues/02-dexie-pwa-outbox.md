# 02 — الگوهای Dexie + PWA + outbox برای معماری آفلاین‌فرست

Type: research
Status: open
Blocked by: —

## Question

برای apps/web (React + Vite + Tailwind + shadcn/ui) چه الگوها و تنظیماتی برای لایهٔ آفلاین درست است؟

- Dexie + dexie-react-hooks (live queries) در کنار TanStack Query: کدام state در Dexie می‌ماند و کدام سمت TanStack Query؟ الگوهای رایج.
- طرح جداول لوکال آمادهٔ outbox: UUID محلی، updatedAt، پرچم synced؛ صف mutation؛ حلقهٔ سینک روی رویدادهای online/offline و retry-on-reconnect.
- vite-plugin-pwa: app-shell caching، استراتژی کش برای درخواست‌های API، آپدیت service worker، سازگاری با نسخه‌های فعلی Vite/React.
- کش سشن و داده برای استفادهٔ آفلاین کامل (app shell + دادهٔ کش‌شده، صف تا اتصال مجدد).
- مقصد یافته‌ها: `.scratch/expense-tracker/research/dexie-pwa-outbox.md`
