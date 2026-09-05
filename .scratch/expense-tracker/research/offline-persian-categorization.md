# پژوهش: دسته‌بندی آفلاین عنوان‌های کوتاه خرج فارسی، کاملاً داخل مرورگر

تاریخ پژوهش: 2026-09-06. نسخه‌ها و قواعد مستقیماً از npm registry، سورس hazm (roshan-research) و ریپوهای رسمی استخراج شده‌اند. سؤال تیکت: [`issues/01-offline-persian-categorization.md`](../issues/01-offline-persian-categorization.md).

## TL;DR — توصیه

**«واژه‌نامهٔ نرمال‌شده + شمارش یادگرفته» (dictionary-first با fallback شمارشی)، TypeScript خالص و بدون هیچ وابستگی ML.** موتور = یک نرمال‌سازِ ~۲۰ خطی + دو `Map` درون‌حافظه‌ای (کلیدِ عبارت → دسته، کلیدِ توکن → دسته) + یک نردبان اولویت شش‌پله‌ای. یادگیری از انتساب دستی کاربر صرفاً «افزایش/کاهش شمارش» در همین Map هاست و در Dexie (جدول `learnedKeys`) ذخیره می‌شود — یعنی مدلِ یادگیرنده و واژه‌نامه یک معماری واحد دارند و اولویت «یادگرفته > سیستمی» یک مقایسهٔ ترتیبی ساده است. این طرح در هر کی‌استروک چند میکروثانیه کار می‌کند (فقط O(n) نرمال‌سازی روی رشتهٔ ≤۴۰ نویسه + چند lookup در Map)، صفر بایت مدل دانلود می‌خواهد و کاملاً آفلاین است. کتابخانه‌های آماده رد شدند: `bayes` (API ناهمگام، بدون score، بدون نگهداری)، `wink-*` (وابسته به مدل انگلیسی)، `@xenova/transformers` (~46MB + ONNX — نقض بودجهٔ آفلاین/میکروثانیه). تنها وابستگی اختیاری پیشنهادی: `fastest-levenshtein` (چند صد بایت) برای پلهٔ fuzzy؛ حتی همان هم می‌توانیم دستی بنویسیم.

## 1. مقایسهٔ گزینه‌ها

| گزینه | دقت برای عنوان کوتاه فارسی | سرعت | حافظه/دانلود | یادگیری از کاربر | حکم |
|---|---|---|---|---|---|
| (a) کلیدواژه/Map + دیکشنری یادگرفته | عالی — عنوان خرج ذاتاً «کلیدواژه‌محور» است (نان، اسنپ، قبض برق) | میکروثانیه (Map lookup) | ~۲–۵KB واژه‌نامهٔ seed + رکوردهای Dexie | ذاتی — یک increment | **پذیرفته (بخش اصلی)** |
| (b) naive Bayes / TF-IDF آماده | خوب ولی برای دامنهٔ ۶–۲۰ دسته و واژگان محدود، overkill | `bayes@1.0.0`: `categorize` **Promise برمی‌گرداند** و score/confidence ندارد ([GitHub ttezel/bayes](https://github.com/ttezel/bayes)، [npm](https://registry.npmjs.org/bayes/latest)) | صفر dep ولی node-محور، ۹ سال بدون release | `learn()/toJson` کل state | رد — پلهٔ «fallback شمارشی» همان Bayesِ ساده‌شده را می‌دهد |
| (b') wink-naive-bayes-text-classifier 2.2.1 | — | — | dep روی `wink-nlp` + `wink-eng-lite-web-model` (مدل انگلیسی) ([npm](https://registry.npmjs.org/wink-naive-bayes-text-classifier/latest)) | — | رد |
| (c) embeddings روی دستگاه (`@xenova/transformers` 2.17.2) | برای متن کوتاه خوب | ده‌ها میلی‌ثانیه + worker | ~46MB unpacked، `onnxruntime-web` ([npm](https://registry.npmjs.org/@xenova/transformers/latest)) | نیاز به fine-tune | رد — نقض «میکروثانیه» و آفلاین‌فرست |
| (c') fuzzy matching (Levenshtein / fuse.js 7.5.0) | مکمل برای typo | µs برای یک توکن | چند بایت | — | **پذیرفته (فقط پلهٔ آخر)** |

دلیل اصلی (a): ورودیِ ما یک «عنوان» است، نه پاراگراف — نویز کم، سیگنال متراکم. تجربهٔ همهٔ دسته‌بند تراکنش‌های بانکی (موتور rule-based با اولویت) همین را می‌گوید. Bayes فقط وقتی می‌ارزد که کلیدواژه‌ها مبهم باشند؛ پلهٔ ۶ ما (بخش 4) همان را با ~۳۰ خط می‌دهد بدون سوئیچ پارادایم.

## 2. نرمال‌سازی فارسی — خط لولهٔ دقیق (قلب سیستم)

قواعد مرجع از سورس `hazm` ([normalizer.py](https://github.com/roshan-research/hazm/blob/master/hazm/normalizer.py)، [constants.py](https://github.com/roshan-research/hazm/blob/master/hazm/constants.py)) — همان‌ها را مینیمال و در TS پیاده می‌کنیم (hazm پایتون است و پورت JS رسمی ندارد):

```ts
// apps/web/src/classify/normalize.ts
const CHAR_MAP: Record<string, string> = {
  "\u064A": "\u06CC", // ي (arabic yeh)  → ی
  "\u0643": "\u06A9", // ك (arabic kaf)  → ک
  "\u0623": "\u0627", "\u0625": "\u0627", "\u0671": "\u0627", // أ إ ٱ → ا
  "\u0629": "\u0647", // ة → ه
};
const STRIP = /[\u064B-\u0652\u0670\u0640\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
//              ^ اعراب+تنوین (fathatan..sukun)  ^آ  ^کشیده  ^علائم جهت RTL/LTR
const DIGITS = /[\u06F0-\u06F9\u0660-\u0669]/g; // ۰-۹ و ٠-٩ → لاتین (داخل)
const SEP = /[\s\u00A0\u200C]+/g; // فاصله‌ها + نیم‌فاصله (ZWNJ) = جداکنندهٔ واحد

export function canonical(input: string): string {
  let s = input.normalize("NFKC"); // فرم‌های نمایشی عربی (کپی از PDF/Word) → حرف پایه
  s = s.replace(STRIP, "").replace(DIGITS, (d) => String(d.charCodeAt(0) & 0xf));
  s = s.toLowerCase().replace(/[\u0623-\u0671]/g, (c) => CHAR_MAP[c] ?? c);
  for (const [k, v] of Object.entries(CHAR_MAP)) s = s.split(k).join(v);
  return s.replace(SEP, " ").trim(); // فرم کانونی: هر ZWNJ/فاصله = یک فاصله
}
```

نکته‌های حیاتی (همه از قواعد hazm برداشت شده و در سورس آن قابل ردیابی‌اند):

- **ی/ی و ک/ک:** `String.normalize("NFKC")` این دو را تبدیل **نمی‌کند** (هم‌ارز compatibility نیستند) — map دستی الزامی است؛ hazm همین کار را با جدول `TRANSLATION_SRC/DST` می‌کند.
- **NFKC را نگه دارید:** حروف «فرم نمایشی» (U+FB50–U+FEFF) که از کپی پیامک بانک/PDF می‌آیند را به حرف پایه برمی‌گرداند (hazm هم کل این بازه‌ها را در جدول unification دارد).
- **ارقام:** hazm `0-9` و `٠-٩` را به ۰-۹ فارسی می‌بَرد؛ ما عکسش (همه → لاتین) چون نمایش در UI لایهٔ جدا دارد و مقایسهٔ داخلی ساده می‌شود.
- **ZWNJ (U+200C) — تصمیم کلیدی:** hazm ZWNJ را «ترمیم» می‌کند (تکرارش را می‌بندد، سرِ کلمه از آن پاک می‌شود، برای `ها`/`تر`/`می` دوباره درج می‌کند). ما برای دسته‌بندی ساده‌تر و مقاوم‌تر عمل می‌کنیم: **ZWNJ و فاصله هم‌ارز جداکننده‌اند** تا «سبوس‌دار / سبوس دار / سبوسدار» یک کلید شوند. پیامد: کلید عبارتی از unigram/bigram توکن‌ها ساخته می‌شود، نه رشتهٔ خام.
- **\b جاوااسکریپت با فارسی کار نمی‌کند** (`\w` فقط ASCII است) — هیچ‌جا از `\b` استفاده نکنید؛ جداکنندهٔ صریح (`SEP`) گذاشتیم.
- کاهش حروف تکراری (`خیلیییی`) و ترمیم نیم‌فاصلهٔ فعل‌ها (`نمی کنم`→`نمی‌کنم`) hazm با دیکشنری انجام می‌دهد؛ برای عنوان خرج **لازم نیست** — پلهٔ fuzzy پوششش می‌دهد.
- **پکیج اشتباه نصب نکنید:** `persian-tools` unscoped روی npm منسوخ/deprecated است؛ نسخهٔ درست `@persian-tools/persian-tools` 4.0.4 است (deps: فقط `fastest-levenshtein`؛ Node/Bun/browser) ([npm](https://registry.npmjs.org/@persian-tools%2Fpersian-tools/latest)، [GitHub](https://github.com/persian-tools/persian-tools)). ابزارهایش (`digitsFaToEn/digitsArToFa/isPersian/slugify/cleanText`) مفیدند ولی نرمال‌سازِ کامل کانونی ندارد؛ ما خط لولهٔ خودمان را منبع حقیقت می‌کنیم و این پکیج اختیاری است.

## 3. استخراج کلیدواژهٔ بارز (salient keyword) از عبارت

1. `canonical()` را اجرا کن → فرم کانونی (`"خرید نون" → "خرید نون"`، `"قبضِ برق ۲" → "قبض برق 2"`).
2. توکنایز روی فاصله → tokens.
3. **Stopwordهای عنوان‌خرجی** را بینداز (فهرست ~۲۰تایی خودمان، نه فهرست عمومی ۷۰۰تایی hazm [stopwords.dat](https://github.com/roshan-research/hazm/blob/master/hazm/data/stopwords.dat)): `خرید، هزینه، بابت، برای، از، به، و، در، دارم، دادم، کردم، رفتم، یک، ...` — دلیل: «خرید نان» و «نان خریدم» هر دو باید به `نان` برسند.
4. کلیدهای عبارتی: unigramها + bigramهای توکن‌های باقی‌مانده + کل عبارت کانونی. (stemming فارسی **نکنید** — استمر سبک قابل‌اعتماد برای فارسی محاوره در JS وجود ندارد؛ به‌جایش واژه‌نامه alias صریح دارد: `نون → نان`، `تاکسی اینترنتی → اسنپ` و…؛ بقیه را یادگیری می‌پوشاند.)

## 4. نردبان امتیازدهی و اولویت (هر کی‌استروک)

```
classify(input) → { categoryId, confidence, source } | null
  1. learned[phrase]     — کلید عبارتی که کاربر خودش یاد داده (شمارش ≥ 1)
  2. learned[token]      — بهترین توکن بارز در دیکشنری یادگرفته
  3. lexicon[phrase]     — واژه‌نامهٔ seed سیستم
  4. lexicon[token]      — واژه‌نامهٔ seed سیستم (توکنی)
  5. prefix/starts-with  — «نان» هنوز در حال تایپ ← فقط پیشنهاد UI، نه auto-assign
  6. fuzzy: Levenshtein ≤ 1 (توکن ≥ 4 حرف) یا ≤ 2 (≥ 7 حرف) [fastest-levenshtein]
  7. هیچ — null: UI دسته را خالی/پیش‌فرض می‌گذارد، هرگز حدسِ ضعیف را نمی‌زند
```

- **اولویت learned > lexicon در همان توکن:** اگر کاربر `نان` را به دستهٔ سفارشی «خواربار فروشگاه X» برده، از دفعهٔ بعد پلهٔ ۲ از پلهٔ ۴ جلو می‌زند — override طبیعی و بدون خونریزی.
- **امتیاز اطمینان (ورودی‌های تصمیم UI):** برای هر کلید، `purity = count(key,cat) / count(key,*)` و `support = count(key,cat)`. پیشنهاد نمایشی وقتی `purity ≥ 0.6`؛ auto-assign پنهان وقتی `support ≥ 2 && purity ≥ 0.75`؛ بین این دو، چیپ «شاید: خوراکی؟» در UI. top-2 کاندید را هم برگردانید تا UI چیپ‌های پیشنهاد بسازد.
- fuzzy و prefix هرگز `confidence: 'high'` برنمی‌گردانند و فقط وقتی عنوان ≥ 3 حرف اجرا می‌شوند (debounce 150ms کافی است؛ بدون آن هم هزینه قابل‌چشم‌پوشی است).

## 5. یادگیری از انتساب دستی کاربر

- رویدادها: (1) کاربر دسته را دستی انتخاب کرد، (2) کاربر پیشنهاد را تأیید/رد کرد. هر دو به یک تابع `learn(canonicalTitle, categoryId, {accepted:boolean})` می‌روند.
- آپدیت: برای کلید عبارت + هر unigram/bigram بارز: `count[key][categoryId]++`؛ در **اصلاح** (کاربر دستهٔ دیگری گذاشت یا پیشنهاد را رد کرد): `count[key][otherCat] *= 0.5` — لغو نرم، نه hard-set، تا حدس بعدی هوشمند بماند.
- ذخیره: جدول Dexie `learnedKeys` (بخش 6)؛ بازسازی دو `Map` هاست در boot یک‌باره (`load + rebuild`، برای چند هزار رکورد < 10ms).
- هرس (prune): بعد از هر سینک/هفتگی — کلیدهایی که `total < 1` بعد از decay یا بیش از 500 کلید به‌ازای هر دسته → حذف قدیمی‌ترین با `updatedAt`. سینک رکوردهای `learnedKeys` هم مثل بقیهٔ داده با outbox/LWW انجام می‌شود.

## 6. طرح داده

```ts
// seed سیستم — ماژول TS باندل‌شده (بدون fetch؛ PWA precache می‌شود)
// apps/web/src/classify/lexicon.ts
export const LEXICON: ReadonlyArray<[key: string, categoryId: string]> = [
  ["نان", "groceries"], ["نان سنگک", "groceries"], ["نون", "groceries"],
  ["اسنپ", "transport"], ["تپسی", "transport"], ["مترو", "transport"],
  ["قبض برق", "bills"], ["قبض گاز", "bills"], ["اینترنت", "bills"],
  ["آرایشگاه", "health-beauty"], ["داروخانه", "health-beauty"],
  ["قسط", "installment"], /* ... برای ۶ دستهٔ پایه، ~۶۰–۱۲۰ کلید */
];

// apps/web/src/local/db.ts — یک جدول جدید کنار Expense/Category
export interface LearnedKey {
  key: string;        // فرم کانونی (unigram/bigram/phrase)
  category: string;   // categoryId
  count: number;      // شمارش مثبت (بعد از decay اعشاری هم می‌شود)
  updatedAt: number;  // epoch ms — LWW سینک
  synced: 0 | 1;
}
// db.version(n).stores({ ..., learnedKeys: "[key+category], key, updatedAt, synced" })
```

Runtime index (دو `Map<string, Map<string, number>>` برای phrase و token) در یک ماژول سینگلتون `classifier.ts`؛ API خالص و همگام: `classify(title): Suggestion | null`، `learn(...)`. Trie لازم نیست — `Map` در V8 هش‌تری است و تا ده‌ها هزار کلید فرقی ندارد؛ trie فقط از مرتبهٔ صدها هزار کلید می‌ارزد.

## 7. بودجهٔ عملکرد (کی‌استروک)

- نرمال‌سازی: چند replace روی رشتهٔ ≤ 40 نویسه → O(n) چند میکروثانیه در V8.
- دسته‌بندی: ≤ ~8 توکن × 2 Map lookup + (به‌ندرت) یک Levenshtein روی ~۱۰۰ کلید حرف‌کوتاه → همچنان زیر ~50µs.
- هیچ کاری در classify به IndexedDB نمی‌زند (همه‌چیز in-memory) — latency سینک/ناهمگام صفر؛ با `useMemo`/`useDeferredValue` در React هم هیچ رندر اضافه‌ای نمی‌سازد.

## 8. ریسک‌ها / تله‌های خاص فارسی (چک‌لیست تست Vitest)

1. کیبورد عربی/پیامک بانک: `ي ك` و ارقام `٠-٩` — تست: «كارت به كارت ۵٠٠».
2. فرم‌های نمایشی از کپی (U+FB50–U+FEFF) — تست NFKC.
3. نیم‌فاصله به‌جای فاصله و برعکس: «نان سبوس‌دار» = «نان سبوس دار» = «نان سبوسدار».
4. اعراب/تنوین در تایپ رسمی: «قبضِ برق»، «کافِه».
5. کشیده (tatweel) و علائم جهت‌دهی نامرئی RTL (U+200E/F، U+202A–E) از کپی.
6. املای محاوره: «نون»، «تاکسی»، «قطار شهری» — alias seed + یادگیری.
7. ترتیب کلمات و صیغه‌ها: «نان خریدم» ≈ «خرید نان» — توکن‌محوری حلش می‌کند؛ phrase فقط وقتی دقیق‌تر است که bigram کامل در هر دو باشد.
8. توکن مبهم («خرید» تنها، «بیمه») — purity پایین → هیچ یا چیپ «شاید»؛ هرگز auto-assign.
9. عنوان صرفاً عددی/لاتین («2000»، «Coffee») — lowercase لاتین در نرمال‌ساز هست؛ دستهٔ ناشناخته → null.
10. تست RTL در Vitest/jsdom عادی است (رشته‌ها دوجهته‌اند در سطح کد)؛ فقط در snapshot ها به ترتیب بایت حواس جمع باشد.

## 9. منابع

- hazm (roshan-research) — قواعد نرمال‌سازی مرجع فارسی: [normalizer.py](https://github.com/roshan-research/hazm/blob/master/hazm/normalizer.py) | [constants.py](https://github.com/roshan-research/hazm/blob/master/hazm/constants.py) (جدول TRANSLATION، NUMBERS `0-9،٠-٩ → ۰-۹`، DIACRITICS `\u064b-\u0652`، ZWNJ، حروف تکراری، ترتیب pipeline) | [stopwords.dat](https://github.com/roshan-research/hazm/blob/master/hazm/data/stopwords.dat)
- [tęzel/bayes@1.0.0](https://github.com/ttezel/bayes) — `categorize` ناهمگام، بدون score؛ [npm](https://registry.npmjs.org/bayes/latest)
- [wink-naive-bayes-text-classifier@2.2.1](https://github.com/winkjs/wink-naive-bayes-text-classifier) — وابسته به مدل انگلیسی wink؛ [npm](https://registry.npmjs.org/wink-naive-bayes-text-classifier/latest)
- [@persian-tools/persian-tools@4.0.4](https://github.com/persian-tools/persian-tools) — `digitsFaToEn/digitsArToFa`، browser-ready، dep فقط `fastest-levenshtein`؛ [npm](https://registry.npmjs.org/@persian-tools%2Fpersian-tools/latest) | نسخهٔ unscoped `persian-tools` deprecated است ([npm](https://registry.npmjs.org/persian-tools/latest))
- [@xenova/transformers@2.17.2](https://registry.npmjs.org/@xenova/transformers/latest) — ~46.6MB unpacked + `onnxruntime-web` → رد شد
- [fuse.js@7.5.0](https://registry.npmjs.org/fuse.js/latest) — fuzzy-search سبک مرورگری (جایگزین بزرگ‌تر fastest-levenshtein)
- [fastest-levenshtein](https://www.npmjs.com/package/fastest-levenshtein) — Levenshtein سریع JS، بدون dep
