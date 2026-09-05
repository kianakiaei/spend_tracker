# نقشهٔ wayfinder: مدیریت هزینهٔ ماهانه (expense-tracker)

Labels: wayfinder:map

## Destination

یک وب‌اپ فارسیِ راست‌چین و آفلاین‌فرست برای مدیریت هزینهٔ ماهانه: جمع هزینه‌های هر ماه جلالی به تفکیک دسته (خوراکی، کافه-رستوران، حمل‌ونقل، زیبایی و درمان، قسط، قبض و اینترنت + دسته‌های قابل‌افزودن)، کلیک روی هر دسته = لیست خرج‌های آن، دسته‌بندی خودکارِ کاملاً آفلاین که از انتساب‌های دستی کاربر یاد می‌گیرد، ورود با better-auth و سینک کامل (outbox / last-write-wins). خروجی نهایی این تلاش اپ کارا و تست‌شده با استک تعیین‌شده است — طبق تصمیم کاربر، این تلاش اجرا را هم خودش حمل می‌کند (برخلاف پیش‌فرضِ «فقط برنامه‌ریزی»).

## Notes

- تصمیم‌های ترسیم (گریلینگ، 2026-09-06): خروجی = اپ کارا (نه فقط اسپک)؛ better-auth از روز اول؛ سینک کامل در MVP.
- استک (خواستهٔ صریح کاربر): pnpm workspaces — apps/api (Hono + SQLite + Drizzle + drizzle-kit + @hono/zod-validator + typed RPC با hc)، apps/web (React + Vite + Tailwind + shadcn/ui + vite-plugin-pwa + TanStack Query)، packages/shared (Zod، اشتراک اسکیما بین کلاینت/سرور). TypeScript سخت‌گیرانه، بدون any. پوشش تست: Vitest بک‌اند-محور، RTL+jsdom برای جریان‌های حیاتی، Playwright برای E2E.
- Runtime بک‌اند حل شد: Node 24 LTS + better-sqlite3 (نه Bun روی ویندوز)؛ آداپتور DB در یک فایل ایزوله بماند تا مهاجرت بعدی به Bun یا node:sqlite ارزان باشد — جزئیات در تیکت «اسکفولد مونوریپو».
- لایهٔ محلی: Dexie روی IndexedDB؛ الگوی outbox (UUID محلی، updatedAt، پرچم synced)؛ تعارض‌ها با last-write-wins.
- محلی‌سازی: UI فارسی RTL مینیمال، فونت Vazirmatn؛ مبالغ تومان با `Intl.NumberFormat('fa-IR')`؛ تاریخ‌ها به میلادی ذخیره و فقط در نمایش جلالی می‌شوند (date-fns-jalali + react-multi-date-picker).
- مهارت‌های الزامی هر سشن: frontend-design برای هر کار UI (الزام صریح کاربر)؛ domain-modeling هنگام تثبیت اصطلاح‌ها (اولین جا: تیکت «مدل داده و قرارداد سینک» CONTEXT.md را می‌سازد)؛ research برای تیکت‌های research.
- Tracker همین‌جاست: `map.md` + `issues/NN-*.md`؛ یافته‌های تحقیق زیر `research/`.
- طبق AGENTS.md: بعد از هر گام معنادار کامیت کوچک و منطقی؛ `.env` هرگز کامیت نمی‌شود (الگوی `!.env.example` در .gitignore هست).

## Decisions so far

- [اسکفولد مونوریپو: Hono + Drizzle + better-auth (+ انتخاب runtime)](issues/03-hono-drizzle-auth-monorepo.md): Node 24 LTS + better-sqlite3 13 (prebuilt ویندوز؛ Bun حذف شد)؛ نسخه‌های فعلی (hono 4.13.7، drizzle-orm 0.45.2، better-auth 1.7.2، zod 4.5.4) و جریان migration ثبت شد؛ الگوی RPC تایپ‌سیف با `AppType`/`hc` و طرح سینک دسته‌ای (`POST /api/sync`، LWW سمت سرور، tombstone، op id برای idempotency) به‌عنوان ورودی تیکت «مدل داده و قرارداد سینک» تعیین شد.
- [روش‌های دسته‌بندی خودکار فارسی، کاملاً آفلاین در مرورگر](issues/01-offline-persian-categorization.md): موتور «واژه‌نامهٔ نرمال‌شده + شمارنده‌های یادگرفته» در TypeScript خالص، بدون هیچ وابستگی ML؛ نرمالایزر فارسی (~۲۰ خط، بر پایهٔ قواعد hazm) + نردبان اولویت شش‌مرحله‌ای (یادگرفته > سیستمی > پیشوند > فازی Levenshtein؛ حدس ضعیف هرگز خودکار وصل نمی‌شود)؛ جدول Dexie با نام `learnedKeys` (کلید+دسته، شمارنده با decay، synced) که با outbox سینک می‌شود؛ مدل‌های آماری و transformers به‌دلیل حجم/نگهداری رد شدند؛ `persian-tools` اسکوپ‌نشده منسوخ است (نسخهٔ @-اسکوپ‌شده فقط برای ارقام).
- [الگوهای Dexie + PWA + outbox](issues/02-dexie-pwa-outbox.md): Dexie تنها منشأ حقیقت داده‌های اپ (خواندن با `useLiveQuery`)؛ TanStack Query فقط برای دادهٔ صرفاً سروری، هرگز دادهٔ خرج؛ PK = UUIDv7 با `uuid` 14.0.2 (نه `crypto.randomUUID`)؛ entity + op در یک تراکنش Dexie؛ حلقهٔ سینک روی online/visibilitychange/تایمر ۳۰ثانیه‌ای (Background Sync API رد شد — Chromium-only)؛ vite-plugin-pwa 1.3.0 با generateSW، registerType: 'prompt' + توست reload، navigateFallback با denylist `/api/`، فونت وزیرمتن سلف‌هاست در precache؛ کش داده «فقط Dexie» بدون runtime caching برای API؛ سشن در کوکی httpOnly می‌ماند و فقط پروفایل مینیمال لوکال کش می‌شود.
- [ابزار تاریخ جلالی](issues/04-jalali-dates.md): ذخیرهٔ رشتهٔ date-only میلادی + تبدیل فقط در نمایش؛ date-fns-jalali ^4.4.0-0 (fork وفادار date-fns v4) برای مرز ماه جلالی — کلید ماه = `format(d,'yyyy-MM')` یعنی «1405-06»؛ react-multi-date-picker ^4.5.2 با `calendar={persian}` و state میلادی، سازگار React 19؛ Intl فقط برای ارقام و رشته‌های آمادهٔ نمایش (ICU و jalaali-js روی ۲۴هزار روز آزمایش شد، ناسازگاری صفر)؛ هرگز `new Date('YYYY-MM-DD')` نه — `parseISO`؛ یک ماژول util واحد (`jalali-date.ts`) تنها نقطهٔ ورود این نگرانی‌ها.
- [مدل داده و قرارداد سینک](issues/05-data-model-sync-contract.md): مبلغ = عدد صحیح تومان؛ منع حذف دستهٔ دارای خرج (با میان‌بر انتقال گروهی) → categoryId همیشه ست و «بدون دسته» وجود ندارد؛ تکرار خودکار در MVP به‌شکل «الگوی تکرار + تولید خودکار اولِ ماه، قابل ویرایش» با روزِ بی‌ماه چسبان به آخرِ ماه و تولید idempotent بر (الگو، کلید ماه)؛ چهار موجودیت سینک‌شونده (categories، expenses، recurringTemplates، learnedKeys) با ستون‌های استاندارد سینک + جداول فقط-محلی outboxOps/appState؛ قرارداد سینک: `POST /api/sync` دسته‌ای، LWW با updatedAt، tombstone، opId idempotent؛ `CONTEXT.md` (واژه‌نامهٔ دامنه) ساخته شد.

## Not yet specified

- سیدِدینگ محتوایی: واژه‌نامهٔ اولیهٔ فارسی برای ۶ دستهٔ پایه (نان، اسنپ، قبض برق، …) — پس از روشن شدن موتور دسته‌بندی، احتمالاً به تیکت task جدا بالغ می‌شود.
- UX وضعیت سینک: نشانگر آنلاین/آفلاین/در-صف، پیام تعارض LWW برای کاربر.
- پلن تست دقیق هر ماژول (استک تست تعیین شده؛ تفکیک آن با شروع پیاده‌سازی روشن می‌شود).
- مقصد دیپلوی و مدیریت سکرت‌های `.env` (نزدیک انتها).
- پیش‌نمایش اقساطِ ماه‌های آینده هنگام ناوبری به ماه‌های بعد (الگوها تا وقتی ماهشان نرسیده تولید نمی‌شوند — تولید فقط در ماه جاری).

## Out of scope

- بودجه‌بندی و سقف دسته‌ها — درخواست نشده.
- نمودار و گزارش تحلیلی فراتر از جمع ماهانه و تفکیک دسته — درخواست نشده.
- چند ارز — فقط تومان.
- اسکن رسید/OCR و استخراج خودکار از پیامک بانک.
- اپ موبایل نیتیو — PWA پوشش می‌دهد.
- اشتراکِ داده بین کاربران — multi-user فقط به معنای حسابِ جدا برای هر کاربر.
