"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { canonical } from "@/lib/categorization/normalize";
import { formatNumber } from "@/lib/format";
import {
  formatJalali,
  formatToman,
  fromISODate,
  fromJalaliMonthKey,
  jalaliMonthLabel,
  toPersianDigits,
} from "@/lib/jalali";
import type { AllTimeProductInsight } from "@/lib/services";

interface MonthBucket {
  monthKey: string;
  count: number;
  avgUnitPrice: number;
}

function shortMonth(monthKey: string) {
  return formatJalali(fromJalaliMonthKey(monthKey), "MMMM");
}

function MonthlyChart({
  product,
  hover,
  setHover,
}: {
  product: AllTimeProductInsight;
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const buckets: MonthBucket[] = useMemo(() => {
    const byMonth = new Map<string, { amount: number; qty: number; n: number }>();
    for (const pt of product.points) {
      const b = byMonth.get(pt.monthKey);
      if (b) {
        b.amount += pt.amountToman;
        b.qty += pt.quantity;
        b.n += 1;
      } else {
        byMonth.set(pt.monthKey, {
          amount: pt.amountToman,
          qty: pt.quantity,
          n: 1,
        });
      }
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([monthKey, b]) => ({
        monthKey,
        count: b.n,
        avgUnitPrice: Math.round(b.amount / b.qty),
      }));
  }, [product]);

  const vals = buckets.map((b) => b.avgUnitPrice);
  const min = Math.min(...vals, product.overallAvgUnit);
  const max = Math.max(...vals, product.overallAvgUnit);
  const span = Math.max(max - min, 1);
  const W = 560;
  const H = 240;
  const PAD_SIDE = 20;
  const PAD_TOP = 26;
  const PAD_BOTTOM = 34;
  const X = (i: number) =>
    vals.length === 1
      ? W / 2
      : PAD_SIDE + (i / (vals.length - 1)) * (W - PAD_SIDE * 2);
  const Y = (v: number) =>
    H - PAD_BOTTOM - ((v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);
  const readout = hover !== null ? buckets[hover] : null;

  return (
    <div
      className="mt-3 rounded-2xl border border-rule bg-paper p-3"
      onMouseLeave={() => setHover(null)}
    >
      <p
        aria-live="polite"
        className="h-6 text-[13px] text-ink-muted"
      >
        {readout
          ? `${jalaliMonthLabel(fromJalaliMonthKey(readout.monthKey))} · ${formatToman(readout.avgUnitPrice)} · ${toPersianDigits(readout.count)} خرید`
          : "میانگین هر ماه روی نمودار نوشته شده؛ نشانگر را روی نقطه‌ها ببر"}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 w-full"
        role="img"
        aria-label={`میانگین ماهانه ${product.displayTitle}`}
      >
        <line
          x1={PAD_SIDE}
          x2={W - PAD_SIDE}
          y1={Y(product.overallAvgUnit)}
          y2={Y(product.overallAvgUnit)}
          className="stroke-ink-muted"
          strokeOpacity={0.5}
          strokeDasharray="6 5"
          strokeWidth={1.5}
        />
        <polyline
          points={vals.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}
          fill="none"
          className="stroke-accent"
          strokeWidth={2.5}
        />
        {buckets.map((b, i) => {
          const above = i % 2 === 0;
          return (
            <g key={b.monthKey}>
              <title>
                {jalaliMonthLabel(fromJalaliMonthKey(b.monthKey))}:{" "}
                {formatToman(b.avgUnitPrice)}
              </title>
              <text
                x={X(i)}
                y={Y(b.avgUnitPrice) + (above ? -12 : 20)}
                textAnchor="middle"
                fontSize={12}
                fontWeight={800}
                className="fill-ink"
              >
                {formatNumber(b.avgUnitPrice)}
              </text>
              <text
                x={X(i)}
                y={H - 10}
                textAnchor="middle"
                fontSize={10.5}
                className="fill-ink-muted"
              >
                {shortMonth(b.monthKey)}
              </text>
              <circle
                cx={X(i)}
                cy={Y(b.avgUnitPrice)}
                r={16}
                fill="transparent"
                style={{ cursor: "crosshair" }}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                aria-label={`${jalaliMonthLabel(fromJalaliMonthKey(b.monthKey))}: ${formatToman(b.avgUnitPrice)}`}
              />
              <circle
                cx={X(i)}
                cy={Y(b.avgUnitPrice)}
                r={hover === i ? 7 : 4.5}
                className={hover === i ? "fill-accent" : "fill-accent"}
                fillOpacity={hover === null || hover === i ? 1 : 0.45}
                strokeWidth={2}
                stroke={hover === i ? "#fafaf7" : "none"}
              />
            </g>
          );
        })}
        {readout && hover !== null && (
          <g pointerEvents="none">
            {(() => {
              const boxW = 132;
              const boxH = 44;
              const bx = Math.min(
                Math.max(X(hover) - boxW / 2, 4),
                W - boxW - 4,
              );
              const by = Y(readout.avgUnitPrice) - boxH - 30;
              const ty = by < 4 ? Y(readout.avgUnitPrice) + 26 : by;
              return (
                <>
                  <rect
                    x={bx}
                    y={ty}
                    width={boxW}
                    height={boxH}
                    rx={10}
                    className="fill-ink"
                  />
                  <text
                    x={bx + boxW / 2}
                    y={ty + 19}
                    textAnchor="middle"
                    fontSize={15}
                    fontWeight={900}
                    className="fill-paper"
                  >
                    {formatNumber(readout.avgUnitPrice)}
                  </text>
                  <text
                    x={bx + boxW / 2}
                    y={ty + 35}
                    textAnchor="middle"
                    fontSize={11}
                    className="fill-paper"
                    opacity={0.75}
                  >
                    {jalaliMonthLabel(fromJalaliMonthKey(readout.monthKey))} ·{" "}
                    {toPersianDigits(readout.count)} خرید
                  </text>
                </>
              );
            })()}
          </g>
        )}
      </svg>
      <p className="mt-1 text-[11.5px] text-ink-muted">
        هر نقطه میانگین وزنی یک ماه است · خط‌چین میانگین کل
      </p>
    </div>
  );
}

export function InsightsBoard({
  products,
}: {
  products: AllTimeProductInsight[];
}) {
  const [openKey, setOpenKey] = useState(products[0]?.key ?? "");
  const [hover, setHover] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = canonical(query);
    if (q === "") return products;
    return products.filter((p) => canonical(p.displayTitle).includes(q));
  }, [products, query]);

  const active =
    filtered.find((p) => p.key === openKey) ??
    filtered[0] ??
    products.find((p) => p.key === openKey) ??
    products[0];

  const history = useMemo(() => {
    if (!active) return [];
    return [...active.points].sort((a, b) => {
      const da = a.occurredAt ?? "";
      const dbb = b.occurredAt ?? "";
      if (da !== dbb) return da < dbb ? 1 : -1;
      return a.expenseId < b.expenseId ? 1 : -1;
    });
  }, [active]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-[20px] font-extrabold">بینش محصول‌ها</h1>
        <nav className="flex gap-4 text-[13px] text-ink-muted">
          <Link href="/" className="hover:text-accent">
            داشبورد
          </Link>
          <Link href="/events" className="hover:text-accent">
            رویدادها
          </Link>
          <Link href="/categories" className="hover:text-accent">
            دسته‌ها
          </Link>
          <Link href="/templates" className="hover:text-accent">
            الگوها
          </Link>
        </nav>
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        میانگین ماهانه هر عدد برای پرتکرارترین عنوان‌ها در همه دوره‌ها
      </p>

      {products.length === 0 ? (
        <p className="py-16 text-center text-[14.5px] leading-8 text-ink-muted">
          هنوز خرید تکراری نیست. چند خرج با عنوان یکسان (مثلاً نان) ثبت
          کنید.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <label htmlFor="product-search" className="sr-only">
              جست‌وجوی محصول
            </label>
            <input
              id="product-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی محصول… مثلاً نان"
              aria-label="جست‌وجوی محصول"
              className="w-full rounded-2xl border border-rule bg-panel px-4 py-2.5 text-[14px] outline-none placeholder:text-ink-muted focus:border-accent"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-ink-muted">
              محصولی با این عنوان پیدا نشد.
            </p>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              {filtered.map((p) => {
                const isOpen = active?.key === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setOpenKey(p.key);
                      setHover(null);
                    }}
                    aria-pressed={isOpen}
                    className={`relative rounded-2xl border bg-panel px-4 pb-3 pt-5 text-right ${isOpen
                      ? "border-accent"
                      : "border-rule hover:border-rule-strong"
                      }`}
                    style={
                      isOpen
                        ? { boxShadow: "0 0 0 2px var(--color-accent-soft)" }
                        : undefined
                    }
                  >
                    <span
                      aria-hidden
                      className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-paper"
                      style={{
                        borderColor: "var(--color-rule-strong)",
                        boxShadow: "inset 0 1px 2px rgba(32,36,31,.25)",
                      }}
                    />
                    <span className="block text-[15px] font-bold">
                      {p.displayTitle}
                    </span>
                    <span className="mt-1 block text-[20px] font-extrabold">
                      {formatNumber(p.overallAvgUnit)}
                    </span>
                    <span className="block text-[11.5px] text-ink-muted">
                      میانگین هر عدد · {toPersianDigits(p.count)} خرید
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {active && (
            <section
              key={active.key}
              className="mt-6 border-t-2 border-ink pt-3"
              aria-label={active.displayTitle}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[16px] font-bold">
                  {active.displayTitle} · {toPersianDigits(active.count)}{" "}
                  خرید
                </h2>
                <p className="text-[12.5px] text-ink-muted">
                  جمع {formatToman(active.totalToman)} · میانگین{" "}
                  {formatToman(active.overallAvgUnit)}
                </p>
              </div>
              <MonthlyChart
                product={active}
                hover={hover}
                setHover={setHover}
              />
              <h3 className="mt-5 text-[14px] font-bold">تاریخچه خریدها</h3>
              <ul aria-label="تاریخچه خریدها" className="mt-2">
                {history.map((pt) => {
                  const label = jalaliMonthLabel(fromJalaliMonthKey(pt.monthKey));
                  return (
                    <li
                      key={pt.expenseId}
                      className="flex items-center justify-between gap-3 border-b border-rule py-2.5"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[13px] font-semibold">
                          {pt.occurredAt
                            ? formatJalali(fromISODate(pt.occurredAt), "d MMMM yyyy")
                            : label}
                        </span>
                        <span className="text-[11.5px] text-ink-muted">
                          {pt.occurredAt ? (
                            label
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-rule bg-panel px-2 py-0.5 text-[11px]">
                              بدون تاریخ
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-[13.5px] font-bold">
                        {formatToman(pt.amountToman)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
