import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SearchBoard } from "@/components/search-board";
import type { SearchResultDto } from "@/lib/schemas";

// The search board (تیکت جست‌وجو): the user types part of an item's title and
// sees every purchase of it — which Jalali month it landed in and for how
// much. The same canonical-Persian tolerance the insights board has
// (yeh/kaf, digits, ZWNJ) applies to the typed query.

function hit(
  overrides: Partial<SearchResultDto> = {},
): SearchResultDto {
  return {
    expenseId: "e1",
    title: "نان سنگک",
    amountToman: 25_000,
    quantity: 2,
    monthKey: "1405-05",
    occurredAt: "2026-07-24",
    categoryName: "خوراکی",
    categoryId: "c1",
    eventTitle: null,
    ...overrides,
  };
}

const RESULTS: SearchResultDto[] = [
  hit(),
  hit({
    expenseId: "e2",
    title: "نان بربری",
    amountToman: 30_000,
    monthKey: "1405-06",
    occurredAt: null,
  }),
  hit({
    expenseId: "e3",
    title: "شیر کاکائو",
    amountToman: 40_000,
    quantity: 1,
    monthKey: "1405-06",
    occurredAt: "2026-08-26",
    categoryName: "خوراکی",
    eventTitle: "سفر شمال",
  }),
];

describe("SearchBoard", () => {
  it("renders the search box", () => {
    render(<SearchBoard results={RESULTS} />);
    expect(screen.getByRole("searchbox", { name: "جست‌وجوی خرج" })).toBeInTheDocument();
  });

  it("lists every hit with its month and price", () => {
    render(<SearchBoard results={RESULTS} />);
    const list = screen.getByRole("list", { name: "نتایج جست‌وجو" });
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(list).toHaveTextContent("۲۵٬۰۰۰ تومان");
    expect(list).toHaveTextContent("مرداد ۱۴۰۵");
  });

  it("marks a hit attached to a رویداد with the event's name badge", () => {
    render(<SearchBoard results={RESULTS} />);
    expect(screen.getByText("سفر شمال")).toBeInTheDocument();
    // The unattached hits render no badge text of their own.
    expect(screen.getAllByText("نان سنگک")).toHaveLength(1);
  });

  it("narrows hits as the user types", () => {
    render(<SearchBoard results={RESULTS} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "جست‌وجوی خرج" }), {
      target: { value: "بربری" },
    });
    const list = screen.getByRole("list", { name: "نتایج جست‌وجو" });
    expect(list).toHaveTextContent("نان بربری");
    expect(list).not.toHaveTextContent("نان سنگک");
  });

  it("matches Persian text independent of yeh spelling", () => {
    render(<SearchBoard results={RESULTS} />);
    // arabic yeh (ي) must still match persian ی in «شیر»
    fireEvent.change(screen.getByRole("searchbox", { name: "جست‌وجوی خرج" }), {
      target: { value: "شير" },
    });
    expect(screen.getByRole("list", { name: "نتایج جست‌وجو" })).toHaveTextContent(
      "شیر کاکائو",
    );
  });

  it("shows a no-match message instead of an empty row", () => {
    render(<SearchBoard results={RESULTS} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "جست‌وجوی خرج" }), {
      target: { value: "پسته" },
    });
    expect(screen.getByText("خرجی با این عنوان پیدا نشد.")).toBeInTheDocument();
  });
});
