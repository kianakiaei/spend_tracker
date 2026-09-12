import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AddExpenseFab,
  ExpenseSheetProvider,
  useExpenseSheet,
} from "@/components/expense-sheet/provider";
import { Ledger } from "@/components/ledger";
import {
  currentJalaliMonthKey,
  formatJalali,
  fromISODate,
  fromJalaliMonthKey,
  jalaliMonthLabel,
  shiftJalaliMonthKey,
  toISODate,
} from "@/lib/jalali";
import { defaultCreateDate } from "@/components/expense-sheet/sheet-helpers";
import type { Category, ExpenseWithCategory } from "@/lib/services";

// Ticket 27 — the expense sheet's behavior contract: the debounced live
// suggestion that goes silent after a manual pick (ticket 06), the live
// fa-IR amount, the per-month date defaults and the explicit target month
// (decision 15), and the typed-client save/edit/delete paths with their
// generic failure voice. The happy flows end-to-end are ticket 30's.

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const api = vi.hoisted(() => ({
  expenses: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/api/client", () => ({ api }));

const NOW = new Date(2026, 8, 6, 12, 0);

const GROCERIES: Category = {
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
const TRANSPORT: Category = { ...GROCERIES, id: "01900000-0000-7000-8000-000000000002", name: "حمل‌ونقل", slug: "transport", order: 2 };
const INSTALLMENT: Category = { ...GROCERIES, id: "01900000-0000-7000-8000-000000000003", name: "قسط", slug: "installment", order: 3 };
const CATEGORIES = [GROCERIES, TRANSPORT, INSTALLMENT];

const UNDATED: ExpenseWithCategory = {
  id: "01900000-0000-7000-8000-000000000101",
  amountToman: 150000,
  quantity: 1,
  unit: "piece",
  title: "شارژ تاکسی",
  note: null,
  categoryId: GROCERIES.id,
  occurredAt: "2026-07-23",
  monthKey: "1405-05",
  sourceRecurringId: null,
  userId: GROCERIES.userId,
  eventId: null,
  createdAt: NOW,
  updatedAt: NOW,
  category: GROCERIES,
};

/** The sheet opened in «مرداد»-like month: always one month behind the real
 * current one, whatever day the suite runs on. */
const otherMonth = shiftJalaliMonthKey(currentJalaliMonthKey(), -1);

function renderCreate(monthKey: string) {
  return render(
    <ExpenseSheetProvider
      monthKey={monthKey}
      categories={CATEGORIES}
      events={[]}
      learnedKeys={[]}
      fallbackCategoryId={GROCERIES.id}
    >
      <AddExpenseFab />
    </ExpenseSheetProvider>,
  );
}

function renderEdit(expense: ExpenseWithCategory) {
  return render(
    <ExpenseSheetProvider
      monthKey={expense.monthKey}
      categories={CATEGORIES}
      events={[]}
      learnedKeys={[]}
      fallbackCategoryId={GROCERIES.id}
    >
      <Ledger
        monthKey={expense.monthKey}
        expenses={[{ ...expense, eventTitle: null }]}
        forecast={[]}
        categories={CATEGORIES}
      />
    </ExpenseSheetProvider>,
  );
}

async function openCreate(monthKey: string) {
  renderCreate(monthKey);
  fireEvent.click(screen.getByRole("button", { name: "ثبت خرج" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
}

/** Synchronous open for fake-timer tests — findBy's polling waits on the
 * very timers the test freezes. */
function openCreateSync(monthKey: string) {
  renderCreate(monthKey);
  fireEvent.click(screen.getByRole("button", { name: "ثبت خرج" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
}

beforeEach(() => {
  refresh.mockClear();
  api.expenses.create.mockReset();
  api.expenses.update.mockReset();
  api.expenses.remove.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("sheet chrome (vaul drawer)", () => {
  it("closes on Escape", async () => {
    await openCreate(otherMonth);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("closes on scrim tap", async () => {
    await openCreate(otherMonth);
    fireEvent.click(document.querySelector(".sheet-scrim")!);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});

describe("sheet focus", () => {
  it("create focuses the title on open on touch", () => {
    vi.useFakeTimers();
    // Mobile: coarse pointer focuses synchronously on open.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true }),
    );
    openCreateSync(otherMonth);
    expect(document.getElementById("expense-title")).toHaveFocus();
  });

  it("create does not autofocus on desktop", () => {
    vi.useFakeTimers();
    // Fine pointer: no delayed focus at all.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false }),
    );
    openCreateSync(otherMonth);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(document.getElementById("expense-title")).not.toHaveFocus();
  });

  it("edit sheets stay keyboard-free", () => {
    vi.useFakeTimers();
    renderEdit(UNDATED);
    fireEvent.click(screen.getByRole("button", { name: /شارژ تاکسی/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByLabelText("عنوان")).not.toHaveFocus();
  });
});

describe("live suggestion (ticket 06 contract)", () => {
  it("updates the chip ~150ms after typing stops, badge on", async () => {
    vi.useFakeTimers();
    openCreateSync(otherMonth);

    // the sheet opens on the fallback answer, already badged
    expect(screen.getByText("خوراکی")).toBeInTheDocument();
    expect(screen.getByText("پیشنهاد")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "تاکسی فرودگاه" },
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // the debounce is still holding
    expect(screen.getByText("خوراکی")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByText("حمل‌ونقل")).toBeInTheDocument();
    expect(screen.getByText("پیشنهاد")).toBeInTheDocument();
  });

  it("a manual pick drops the badge and silences the engine for the form", async () => {
    vi.useFakeTimers();
    openCreateSync(otherMonth);

    fireEvent.click(screen.getByRole("button", { name: "تغییر" }));
    fireEvent.click(screen.getByRole("button", { name: "قسط" }));
    // the chip AND the pressed option both carry it now
    expect(screen.getAllByText("قسط")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "قسط" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("پیشنهاد")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "تاکسی" },
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // the engine is quiet: حمل‌ونقل exists only as its option chip — the
    // chip itself never followed the typed title
    expect(screen.getAllByText("حمل‌ونقل")).toHaveLength(1);
    expect(screen.getAllByText("قسط")).toHaveLength(2);
    expect(screen.queryByText("پیشنهاد")).not.toBeInTheDocument();
  });

  it("the edit sheet starts manual — no badge, no engine", async () => {
    renderEdit(UNDATED);
    fireEvent.click(screen.getByRole("button", { name: /شارژ تاکسی/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("خوراکی")).toBeInTheDocument();
    expect(screen.queryByText("پیشنهاد")).not.toBeInTheDocument();
  });
});

describe("amount field", () => {
  it("shows the typed amount as live fa-IR tomans", async () => {
    await openCreate(otherMonth);
    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "1234500" },
    });
    expect(screen.getByText("۱٬۲۳۴٬۵۰۰ تومان")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "۱۲۰۰۰" },
    });
    expect(screen.getByText("۱۲٬۰۰۰ تومان")).toBeInTheDocument();
  });
});

describe("date field (required picker)", () => {
  it("another month opens on that month's first Jalali day", async () => {
    await openCreate(otherMonth);
    expect(
      screen.queryByRole("button", { name: "حذف تاریخ" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        formatJalali(fromISODate(toISODate(fromJalaliMonthKey(otherMonth)))),
      ),
    ).toBeInTheDocument();
  });

  it("the target month follows the default date of the form's month", async () => {
    await openCreate(otherMonth);
    expect(
      screen.getByText(
        `ثبت در ${jalaliMonthLabel(fromJalaliMonthKey(otherMonth))}`,
      ),
    ).toBeInTheDocument();
  });
});

describe("save path (typed v1 client)", () => {
  it("creates through the client, dated today", async () => {
    api.expenses.create.mockResolvedValue({});
    await openCreate(otherMonth);

    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "نان" },
    });
    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "50000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ثبت" }));

    await waitFor(() =>
      expect(api.expenses.create).toHaveBeenCalledWith({
        amountToman: 50000,
        quantity: 1,
        unit: "piece",
        title: "نان",
        categoryId: GROCERIES.id,
        occurredAt: defaultCreateDate(otherMonth),
        eventId: null,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("saves and resets for the next entry on «ثبت و جدید»", async () => {
    api.expenses.create.mockResolvedValue({});
    await openCreate(otherMonth);

    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "نان" },
    });
    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "50000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ثبت و جدید" }));

    await waitFor(() =>
      expect(api.expenses.create).toHaveBeenCalledWith({
        amountToman: 50000,
        quantity: 1,
        unit: "piece",
        title: "نان",
        categoryId: GROCERIES.id,
        occurredAt: defaultCreateDate(otherMonth),
        eventId: null,
      }),
    );
    // The sheet stays open on a fresh form, title refocused for rapid entry.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("عنوان")).toHaveValue("");
    expect(screen.getByLabelText("مبلغ")).toHaveValue("");
    expect(document.activeElement).toBe(screen.getByLabelText("عنوان"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("keeps every field and speaks generically when the save fails", async () => {
    api.expenses.create.mockRejectedValueOnce(new TypeError("network down"));
    await openCreate(otherMonth);

    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "نان" },
    });
    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "50000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ثبت" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ذخیره نشد؛ دوباره تلاش کنید.",
    );
    expect(screen.getByLabelText("عنوان")).toHaveValue("نان");
    expect(screen.getByLabelText("مبلغ")).toHaveValue("50000");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("edit sheet from a ledger row", () => {
  it("opens prefilled and patches through the client", async () => {
    api.expenses.update.mockResolvedValue({});
    renderEdit(UNDATED);

    fireEvent.click(screen.getByRole("button", { name: /شارژ تاکسی/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("عنوان")).toHaveValue("شارژ تاکسی");
    expect(screen.getByLabelText("مبلغ")).toHaveValue("150000");

    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "200000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    await waitFor(() =>
      expect(api.expenses.update).toHaveBeenCalledWith(
        UNDATED.id,
        {
          amountToman: 200000,
          quantity: 1,
          unit: "piece",
          title: "شارژ تاکسی",
          categoryId: GROCERIES.id,
          occurredAt: UNDATED.occurredAt,
          eventId: null,
        },
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("opens with the row's date and that date's month subtitle", async () => {
    renderEdit(UNDATED);

    fireEvent.click(screen.getByRole("button", { name: /شارژ تاکسی/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    expect(
      screen.getByDisplayValue(formatJalali(fromISODate(UNDATED.occurredAt))),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `ذخیره در ${jalaliMonthLabel(fromJalaliMonthKey(UNDATED.monthKey))}`,
      ),
    ).toBeInTheDocument();
  });

  it("deletes behind an inline confirm", async () => {
    api.expenses.remove.mockResolvedValue(undefined);
    renderEdit(UNDATED);

    fireEvent.click(screen.getByRole("button", { name: /شارژ تاکسی/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "حذف" }));
    // asking, not deleting
    expect(screen.getByText("این خرج حذف شود؟")).toBeInTheDocument();
    expect(api.expenses.remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "حذف" }));
    await waitFor(() =>
      expect(api.expenses.remove).toHaveBeenCalledWith(UNDATED.id),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("locked create from a category (ticket 28 handoff)", () => {
  /** The drilldown's «افزودن به این دسته» — a plain trigger calling
   * openCreate with the page's category id. */
  function renderLockedCreate(monthKey: string) {
    function Trigger() {
      const { openCreate } = useExpenseSheet();
      return (
        <button type="button" onClick={() => openCreate({ categoryId: INSTALLMENT.id })}>
          افزودن به این دسته
        </button>
      );
    }
    return render(
      <ExpenseSheetProvider
        monthKey={monthKey}
        categories={CATEGORIES}
        events={[]}
        learnedKeys={[]}
        fallbackCategoryId={GROCERIES.id}
      >
        <Trigger />
      </ExpenseSheetProvider>,
    );
  }

  it("opens on the locked category — no picker, no badge, engine silent", async () => {
    vi.useFakeTimers();
    renderLockedCreate(otherMonth);
    fireEvent.click(
      screen.getByRole("button", { name: "افزودن به این دسته" }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    expect(screen.getByText("قسط")).toBeInTheDocument();
    expect(screen.queryByText("پیشنهاد")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "تغییر" }),
    ).not.toBeInTheDocument();

    // a lexicon-heavy title cannot move the chip off the locked category
    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "تاکسی فرودگاه" },
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText("قسط")).toBeInTheDocument();
    expect(screen.queryByText("حمل‌ونقل")).not.toBeInTheDocument();
  });

  it("saves with the locked category and the page's month", async () => {
    api.expenses.create.mockResolvedValue({});
    renderLockedCreate(otherMonth);
    fireEvent.click(
      screen.getByRole("button", { name: "افزودن به این دسته" }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "قسط وام" },
    });
    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "1500000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ثبت" }));

    await waitFor(() =>
      expect(api.expenses.create).toHaveBeenCalledWith({
        amountToman: 1500000,
        quantity: 1,
        unit: "piece",
        title: "قسط وام",
        categoryId: INSTALLMENT.id,
        occurredAt: defaultCreateDate(otherMonth),
        eventId: null,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
