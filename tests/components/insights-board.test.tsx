import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InsightsBoard } from "@/components/insights-board";
import type { AllTimeProductInsight } from "@/lib/services";

function product(
  overrides: Partial<AllTimeProductInsight> = {},
): AllTimeProductInsight {
  return {
    key: "nan",
    displayTitle: "نان سنگک",
    count: 3,
    totalToman: 90_000,
    totalQuantity: 3,
    overallAvgUnit: 30_000,
    yearly: [{ year: "1405", count: 3, totalToman: 90_000, totalQuantity: 3, avgUnitPrice: 30_000 }],
    points: [
      { expenseId: "e1", monthKey: "1405-05", occurredAt: "2026-07-24", unitPrice: 25_000, quantity: 1, amountToman: 25_000 },
      { expenseId: "e2", monthKey: "1405-06", occurredAt: "2026-08-25", unitPrice: 30_000, quantity: 1, amountToman: 30_000 },
      { expenseId: "e3", monthKey: "1405-06", occurredAt: null, unitPrice: 35_000, quantity: 1, amountToman: 35_000 },
    ],
    ...overrides,
  };
}

const PRODUCTS: AllTimeProductInsight[] = [
  product(),
  product({
    key: "shir",
    displayTitle: "شیر",
    count: 2,
    totalToman: 80_000,
    totalQuantity: 2,
    overallAvgUnit: 40_000,
    yearly: [{ year: "1405", count: 2, totalToman: 80_000, totalQuantity: 2, avgUnitPrice: 40_000 }],
    points: [
      { expenseId: "m1", monthKey: "1405-06", occurredAt: "2026-08-26", unitPrice: 40_000, quantity: 1, amountToman: 40_000 },
      { expenseId: "m2", monthKey: "1405-06", occurredAt: "2026-08-27", unitPrice: 40_000, quantity: 1, amountToman: 40_000 },
    ],
  }),
];

describe("InsightsBoard search + purchase history", () => {
  it("renders a search box", () => {
    render(<InsightsBoard products={PRODUCTS} />);
    expect(screen.getByRole("searchbox", { name: "جست‌وجوی محصول" })).toBeInTheDocument();
  });

  it("filters product buttons as the user types", () => {
    render(<InsightsBoard products={PRODUCTS} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "جست‌وجوی محصول" }), {
      target: { value: "شیر" },
    });
    expect(screen.queryByRole("button", { name: /نان سنگک/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /شیر/ })).toBeInTheDocument();
  });

  it("matches Persian text independent of yeh/kaf spelling", () => {
    render(<InsightsBoard products={PRODUCTS} />);
    // arabic yeh (ي) must still match persian ی in «شیر»
    fireEvent.change(screen.getByRole("searchbox", { name: "جست‌وجوی محصول" }), {
      target: { value: "شير" },
    });
    expect(screen.getByRole("button", { name: /شیر/ })).toBeInTheDocument();
  });

  it("shows a no-match message instead of an empty row", () => {
    render(<InsightsBoard products={PRODUCTS} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "جست‌وجوی محصول" }), {
      target: { value: "پسته" },
    });
    expect(screen.getByText("محصولی با این عنوان پیدا نشد.")).toBeInTheDocument();
  });

  it("lists every purchase of the selected product with month and price", () => {
    render(<InsightsBoard products={PRODUCTS} />);
    const history = screen.getByRole("list", { name: "تاریخچه خریدها" });
    // 3 purchases of نان سنگک (selected by default = first product)
    expect(history.querySelectorAll("li")).toHaveLength(3);
    // month label + amount of a dated purchase
    expect(history).toHaveTextContent("شهریور ۱۴۰۵");
    expect(history).toHaveTextContent("۲۵٬۰۰۰ تومان");
    // undated purchase keeps its month with the «بدون تاریخ» chip
    expect(history).toHaveTextContent("بدون تاریخ");
  });
});
