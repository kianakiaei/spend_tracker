// Quantity/unit arithmetic (تعداد / واحد / قیمت واحد) — the pure math the
// insights service (CONTEXT.md: قیمت واحد) runs on every product row,
// extracted for the Expo mobile insights board (expo-mobile ticket 01).
// One rule everywhere: مبلغِ خرج همیشه جمعِ کل است, so the unit price is
// always «مبلغ ÷ تعداد» rounded to whole tomans, and the monthly/overall
// average is the weighted mean (جمع مبالغ ÷ جمع تعدادها), also rounded.
// Missing quantities default to 1, exactly like the services' `?? 1`.

/** قیمت واحد: one row's unit price, rounded to whole tomans. */
export function unitPrice(
  amountToman: number,
  quantity?: number | null,
): number {
  const q = quantity ?? 1;
  return Math.round(amountToman / q);
}

/** Weighted average unit price over a bucket, rounded; 0 when empty. */
export function averageUnitPrice(
  totalToman: number,
  totalQuantity: number,
): number {
  return totalQuantity > 0 ? Math.round(totalToman / totalQuantity) : 0;
}

/** Sum of per-row quantities with the services' `?? 1` default. */
export function totalQuantity(
  quantities: Array<number | null | undefined>,
): number {
  return quantities.reduce<number>((sum, q) => sum + (q ?? 1), 0);
}
