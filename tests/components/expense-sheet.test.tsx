import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AddExpenseFab,
  ExpenseSheetProvider,
} from "@/components/expense-sheet/provider";
import { Ledger } from "@/components/ledger";
import {
  currentJalaliMonthKey,
  fromJalaliMonthKey,
  jalaliMonthLabel,
  shiftJalaliMonthKey,
} from "@/lib/jalali";
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
  title: "شارژ تاکسی",
  note: null,
  categoryId: GROCERIES.id,
  occurredAt: null,
  monthKey: "1405-05",
  sourceRecurringId: null,
  userId: GROCERIES.userId,
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
      learnedKeys={[]}
      fallbackCategoryId={GROCERIES.id}
    >
      <Ledger
        monthKey={expense.monthKey}
        expenses={[expense]}
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

describe("per-month date defaults and the target month", () => {
  it("a non-current month opens undated and labels its own month", async () => {
    await openCreate(otherMonth);
    expect(screen.getByRole("button", { name: "بدون تاریخ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText(
        `ثبت در ${jalaliMonthLabel(fromJalaliMonthKey(otherMonth))}`,
      ),
    ).toBeInTheDocument();
  });

  it("the current month opens on today", async () => {
    await openCreate(currentJalaliMonthKey());
    expect(screen.getByRole("button", { name: "بدون تاریخ" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("pressing «بدون تاریخ» clears a picked date", async () => {
    await openCreate(currentJalaliMonthKey());
    fireEvent.click(screen.getByRole("button", { name: "بدون تاریخ" }));
    expect(screen.getByRole("button", { name: "بدون تاریخ" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("save path (typed v1 client)", () => {
  it("creates through the client with the form's month for an undated expense", async () => {
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
        title: "نان",
        categoryId: GROCERIES.id,
        occurredAt: null,
        entryMonthKey: otherMonth,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
          title: "شارژ تاکسی",
          categoryId: GROCERIES.id,
          occurredAt: null,
        },
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
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
