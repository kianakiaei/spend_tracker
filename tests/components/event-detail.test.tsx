import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EventDetailPanel } from "@/components/event-detail";
import { ExpenseSheetProvider } from "@/components/expense-sheet/provider";
import type { Category, EventRow, ExpenseWithCategory } from "@/lib/services";

// Event detail: «افزودن به این رویداد» opens the sheet with the event
// pre-selected; the expense rows render the shared ledger anatomy.

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

const api = vi.hoisted(() => ({
  expenses: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/api/client", () => ({ api }));

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

const EVENT: EventRow = {
  id: "01900000-0000-7000-8000-000000000201",
  title: "سفر اصفهان",
  note: null,
  startDate: null,
  endDate: null,
  userId: CATEGORY.userId,
  createdAt: NOW,
  updatedAt: NOW,
};

const EXPENSE: ExpenseWithCategory = {
  id: "01900000-0000-7000-8000-000000000101",
  amountToman: 50_000,
  quantity: 1,
  unit: "piece",
  title: "شارژ تاکسی",
  note: null,
  categoryId: CATEGORY.id,
  occurredAt: null,
  monthKey: "1405-06",
  sourceRecurringId: null,
  eventId: EVENT.id,
  userId: CATEGORY.userId,
  createdAt: NOW,
  updatedAt: NOW,
  category: CATEGORY,
};

function renderDetail() {
  return render(
    <ExpenseSheetProvider
      monthKey="1405-06"
      categories={[CATEGORY]}
      events={[EVENT]}
      learnedKeys={[]}
      fallbackCategoryId={CATEGORY.id}
    >
      <EventDetailPanel
        event={EVENT}
        expenses={[EXPENSE]}
        categories={[CATEGORY]}
        monthKey="1405-06"
      />
    </ExpenseSheetProvider>,
  );
}

beforeEach(() => {
  refresh.mockClear();
  api.expenses.create.mockReset();
  api.expenses.update.mockReset();
  api.expenses.remove.mockReset();
});

describe("EventDetailPanel", () => {
  it("lists the event's expenses with the shared row anatomy", () => {
    renderDetail();
    expect(screen.getByText("شارژ تاکسی")).toBeInTheDocument();
    expect(screen.getByText("۵۰٬۰۰۰")).toBeInTheDocument();
  });

  it("opens the sheet with the event pre-selected on «افزودن به این رویداد»", async () => {
    api.expenses.create.mockResolvedValue({});
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: /افزودن به این رویداد/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("رویداد این صفحه")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "بنزین" },
    });
    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "100000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ثبت" }));

    await waitFor(() =>
      expect(api.expenses.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: EVENT.id }),
      ),
    );
  });
});