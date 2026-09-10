import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SearchBoard } from "@/components/search-board";
import { ExpenseSheetProvider } from "@/components/expense-sheet/provider";
import type { SearchResultDto } from "@/lib/schemas";
import type { Category } from "@/lib/services";

// The search board (تیکت جست‌وجو): the user types part of an item's title and
// sees every purchase of it — which Jalali month it landed in and for how
// much. The same canonical-Persian tolerance the insights board has
// (yeh/kaf, digits, ZWNJ) applies to the typed query. A click opens the
// same edit sheet the home ledger uses.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/api/client", () => ({
  api: { expenses: { create: vi.fn(), update: vi.fn(), remove: vi.fn() } },
}));

const NOW = new Date(2026, 8, 6, 12, 0);

const CATEGORY: Category = {
  id: "01900000-0000-7000-8000-000000000001",
  name: "خوراکی",
  icon: null,
  color: "#7c5cff",
  kind: "system",
  order: 1,
  slug: "groceries",
  userId: "01900000-0000-7000-8000-0000000000ff",
  createdAt: NOW,
  updatedAt: NOW,
};

function hit(
  overrides: Partial<SearchResultDto> = {},
): SearchResultDto {
  return {
    expenseId: "01900000-0000-7000-8000-000000000101",
    title: "نان سنگک",
    amountToman: 25_000,
    quantity: 2,
    unit: "piece",
    monthKey: "1405-05",
    occurredAt: "2026-07-24",
    categoryName: "خوراکی",
    categoryId: CATEGORY.id,
    eventTitle: null,
    eventId: null,
    sourceRecurringId: null,
    ...overrides,
  };
}

const RESULTS: SearchResultDto[] = [
  hit(),
  hit({
    expenseId: "01900000-0000-7000-8000-000000000102",
    title: "نان بربری",
    amountToman: 30_000,
    monthKey: "1405-06",
    occurredAt: "2026-08-23",
  }),
  hit({
    expenseId: "01900000-0000-7000-8000-000000000103",
    title: "شیر کاکائو",
    amountToman: 40_000,
    quantity: 1,
    monthKey: "1405-06",
    occurredAt: "2026-08-26",
    categoryName: "خوراکی",
    eventTitle: "سفر شمال",
  }),
];

function renderBoard(results: SearchResultDto[] = RESULTS) {
  return render(
    <ExpenseSheetProvider
      monthKey="1405-06"
      categories={[CATEGORY]}
      events={[]}
      learnedKeys={[]}
      fallbackCategoryId={CATEGORY.id}
    >
      <SearchBoard results={results} />
    </ExpenseSheetProvider>,
  );
}

describe("SearchBoard", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  it("renders the search box", () => {
    renderBoard();
    expect(screen.getByRole("searchbox", { name: "جست‌وجوی خرج" })).toBeInTheDocument();
  });

  it("lists every hit with its month and price", () => {
    renderBoard();
    const list = screen.getByRole("list", { name: "نتایج جست‌وجو" });
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(list).toHaveTextContent("۲۵٬۰۰۰ تومان");
    expect(list).toHaveTextContent("مرداد ۱۴۰۵");
  });

  it("marks a hit attached to a رویداد with the event's name badge", () => {
    renderBoard();
    expect(screen.getByText("سفر شمال")).toBeInTheDocument();
    // The unattached hits render no badge text of their own.
    expect(screen.getAllByText("نان سنگک")).toHaveLength(1);
  });

  it("narrows hits as the user types", () => {
    renderBoard();
    fireEvent.change(screen.getByRole("searchbox", { name: "جست‌وجوی خرج" }), {
      target: { value: "بربری" },
    });
    const list = screen.getByRole("list", { name: "نتایج جست‌وجو" });
    expect(list).toHaveTextContent("نان بربری");
    expect(list).not.toHaveTextContent("نان سنگک");
  });

  it("matches Persian text independent of yeh spelling", () => {
    renderBoard();
    // arabic yeh (ي) must still match persian ی in «شیر»
    fireEvent.change(screen.getByRole("searchbox", { name: "جست‌وجوی خرج" }), {
      target: { value: "شير" },
    });
    expect(screen.getByRole("list", { name: "نتایج جست‌وجو" })).toHaveTextContent(
      "شیر کاکائو",
    );
  });

  it("shows a no-match message instead of an empty row", () => {
    renderBoard();
    fireEvent.change(screen.getByRole("searchbox", { name: "جست‌وجوی خرج" }), {
      target: { value: "پسته" },
    });
    expect(screen.getByText("خرجی با این عنوان پیدا نشد.")).toBeInTheDocument();
  });

  it("opens the edit sheet when a hit is clicked", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /نان سنگک/ }));
    expect(screen.getByRole("dialog", { name: "ویرایش خرج" })).toBeInTheDocument();
    expect(screen.getByLabelText("عنوان")).toHaveValue("نان سنگک");
  });
});
