import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CategoriesManager } from "@/components/categories-manager";
import type { Category } from "@/lib/services";

// Ticket 28 — the categories page's behavior contract: the delete guard
// (disabled on a used category with its count spoken), the «انتقال همهٔ
// خرج‌ها» flow (move → delete through the typed client), create with a
// color swatch, and free rename. The system categories carry the
// undeletable note and never a delete button.

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const api = vi.hoisted(() => ({
  categories: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    moveExpenses: vi.fn(),
  },
}));
vi.mock("@/lib/api/client", () => ({ api }));

const NOW = new Date(2026, 8, 6, 12, 0);
const USER = "01900000-0000-7000-8000-0000000000ff";

const GROCERIES: Category = {
  id: "01900000-0000-7000-8000-000000000001",
  name: "خوراکی",
  icon: null,
  color: "#2f9e6e",
  kind: "system",
  order: 0,
  slug: "groceries",
  userId: USER,
  createdAt: NOW,
  updatedAt: NOW,
};
const BOOKS: Category = { ...GROCERIES, id: "01900000-0000-7000-8000-000000000010", name: "کتاب", slug: null, kind: "custom", order: 6, color: null };
const TRIPS: Category = { ...GROCERIES, id: "01900000-0000-7000-8000-000000000011", name: "سفر", slug: null, kind: "custom", order: 7, color: "#3d7fc4" };
const GYM: Category = { ...GROCERIES, id: "01900000-0000-7000-8000-000000000012", name: "باشگاه", slug: null, kind: "custom", order: 8, color: "#7a5fc4" };

const CATEGORIES = [GROCERIES, BOOKS, TRIPS, GYM];
const EXPENSE_COUNTS = { [TRIPS.id]: 2, [GROCERIES.id]: 5 };
const TEMPLATE_COUNTS = { [GYM.id]: 1 };

function renderManager() {
  return render(
    <CategoriesManager
      initialCategories={CATEGORIES}
      expenseCounts={EXPENSE_COUNTS}
      templateCounts={TEMPLATE_COUNTS}
    />,
  );
}

beforeEach(() => {
  refresh.mockClear();
  api.categories.create.mockReset();
  api.categories.update.mockReset();
  api.categories.remove.mockReset();
  api.categories.moveExpenses.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the list (ticket 28: delete guard + counters)", () => {
  it("speaks each category's usage — خرج and الگو counts, خالی, or the system note", () => {
    renderManager();

    expect(screen.getByText("دستهٔ سیستمی")).toBeInTheDocument(); // خوراکی
    expect(screen.getByText("خالی")).toBeInTheDocument(); // کتاب
    expect(screen.getByText("۲ خرج")).toBeInTheDocument(); // سفر
    expect(screen.getByText("۱ الگو")).toBeInTheDocument(); // باشگاه
  });

  it("disables the delete of a used category and offers the move shortcut instead", () => {
    renderManager();

    const row = screen.getByText("سفر").closest("li")!;
    expect(within(row).getByRole("button", { name: "حذف" })).toBeDisabled();
    expect(within(row).getByRole("button", { name: "انتقال همهٔ خرج‌ها" })).toBeEnabled();
  });

  it("never offers delete or move on a system category", () => {
    renderManager();

    const row = screen.getByText("خوراکی").closest("li")!;
    expect(within(row).queryByRole("button", { name: "حذف" })).not.toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: "انتقال همهٔ خرج‌ها" }),
    ).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "ویرایش" })).toBeEnabled();
  });
});

describe("create flow", () => {
  it("creates through the client with the picked swatch, then refreshes", async () => {
    api.categories.create.mockResolvedValue({
      ...BOOKS, id: "01900000-0000-7000-8000-000000000020", name: "ورزش", color: "#1a7a5c", order: 9,
    });
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "افزودن دسته" }));
    fireEvent.change(screen.getByLabelText("نام دسته"), {
      target: { value: "ورزش" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "یشمی" }));
    fireEvent.click(screen.getByRole("button", { name: "افزودن" }));

    await waitFor(() =>
      expect(api.categories.create).toHaveBeenCalledWith({
        name: "ورزش",
        color: "#1a7a5c",
        icon: null,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByText("ورزش")).toBeInTheDocument();
    // the form folded away
    expect(screen.queryByLabelText("نام دسته")).not.toBeInTheDocument();
  });

  it("speaks generically and keeps the typed name when the create fails", async () => {
    api.categories.create.mockRejectedValueOnce(new TypeError("network down"));
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "افزودن دسته" }));
    fireEvent.change(screen.getByLabelText("نام دسته"), {
      target: { value: "ورزش" },
    });
    fireEvent.click(screen.getByRole("button", { name: "افزودن" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "انجام نشد؛ دوباره تلاش کنید.",
    );
    expect(screen.getByLabelText("نام دسته")).toHaveValue("ورزش");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("rename flow", () => {
  it("renames through the client with the fresh row replacing the old one", async () => {
    api.categories.update.mockResolvedValue({ ...TRIPS, name: "سفرهای شمال" });
    renderManager();

    fireEvent.click(
      within(screen.getByText("سفر").closest("li")!).getByRole("button", { name: "ویرایش" }),
    );
    const input = screen.getByLabelText("نام دسته");
    fireEvent.change(input, { target: { value: "سفرهای شمال" } });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    await waitFor(() =>
      expect(api.categories.update).toHaveBeenCalledWith(TRIPS.id, {
        name: "سفرهای شمال",
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(await screen.findByText("سفرهای شمال")).toBeInTheDocument();
    expect(screen.queryByText("سفر")).not.toBeInTheDocument();
  });
});

describe("delete flow", () => {
  it("deletes an empty custom category behind an inline confirm", async () => {
    api.categories.remove.mockResolvedValue(undefined);
    renderManager();

    const row = screen.getByText("کتاب").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "حذف" }));
    expect(screen.getByText("کتاب حذف شود؟")).toBeInTheDocument();
    expect(api.categories.remove).not.toHaveBeenCalled();

    fireEvent.click(
      within(screen.getByText("کتاب حذف شود؟").closest("li")!).getByRole("button", { name: "حذف" }),
    );
    await waitFor(() =>
      expect(api.categories.remove).toHaveBeenCalledWith(BOOKS.id),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByText("کتاب حذف شود؟")).not.toBeInTheDocument();
  });
});

describe("move-all flow (decision 05/06)", () => {
  it("moves every expense to the picked target, then deletes the emptied category", async () => {
    api.categories.moveExpenses.mockResolvedValue({ moved: 2 });
    api.categories.remove.mockResolvedValue(undefined);
    renderManager();

    const row = screen.getByText("سفر").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "انتقال همهٔ خرج‌ها" }));

    fireEvent.click(screen.getByRole("radio", { name: "خوراکی" }));
    fireEvent.click(screen.getByRole("button", { name: "انتقال و حذف" }));

    await waitFor(() =>
      expect(api.categories.moveExpenses).toHaveBeenCalledWith(TRIPS.id, {
        targetCategoryId: GROCERIES.id,
      }),
    );
    await waitFor(() =>
      expect(api.categories.remove).toHaveBeenCalledWith(TRIPS.id),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByText("سفر")).not.toBeInTheDocument();
  });

  it("keeps the picker when the move fails", async () => {
    api.categories.moveExpenses.mockRejectedValueOnce(new TypeError("network down"));
    renderManager();

    const row = screen.getByText("سفر").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "انتقال همهٔ خرج‌ها" }));
    fireEvent.click(screen.getByRole("radio", { name: "خوراکی" }));
    fireEvent.click(screen.getByRole("button", { name: "انتقال و حذف" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "انجام نشد؛ دوباره تلاش کنید.",
    );
    expect(screen.getByRole("radio", { name: "خوراکی" })).toBeChecked();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("reorder (ticket 28: ترتیب دسته‌ها)", () => {
  it("swaps with the neighbor through two order PATCHes", async () => {
    api.categories.update.mockResolvedValue(TRIPS);
    renderManager();

    // کتاب (index 1) moves up over خوراکی
    fireEvent.click(
      within(screen.getByText("کتاب").closest("li")!).getByRole("button", {
        name: "کتاب به بالا",
      }),
    );

    await waitFor(() =>
      expect(api.categories.update).toHaveBeenCalledWith(BOOKS.id, {
        order: GROCERIES.order,
      }),
    );
    await waitFor(() =>
      expect(api.categories.update).toHaveBeenCalledWith(GROCERIES.id, {
        order: BOOKS.order,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    // the optimistic swap already shows the new order
    const list = screen.getAllByRole("list")[0]!;
    expect(within(list).getAllByText(/خوراکی|کتاب|سفر|باشگاه/)[0]).toHaveTextContent("کتاب");
  });

  it("keeps the old order when the swap fails", async () => {
    api.categories.update.mockRejectedValueOnce(new TypeError("network down"));
    renderManager();

    fireEvent.click(
      within(screen.getByText("کتاب").closest("li")!).getByRole("button", {
        name: "کتاب به بالا",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ترتیب ذخیره نشد؛ دوباره تلاش می‌شود.",
    );
    const list = screen.getAllByRole("list")[0]!;
    expect(within(list).getAllByText(/خوراکی|کتاب|سفر|باشگاه/)[0]).toHaveTextContent("خوراکی");
  });

  it("disables the arrows at the ends", () => {
    renderManager();

    const first = screen.getByText("خوراکی").closest("li")!;
    expect(within(first).getByRole("button", { name: "خوراکی به بالا" })).toBeDisabled();
    expect(within(first).getByRole("button", { name: "خوراکی به پایین" })).toBeEnabled();
  });
});

describe("a template-pointing category (the move API carries expenses only)", () => {
  it("offers no move shortcut — delete disabled with the template note", () => {
    renderManager();

    const row = screen.getByText("باشگاه").closest("li")!;
    expect(within(row).getByRole("button", { name: "حذف" })).toBeDisabled();
    expect(
      within(row).queryByRole("button", { name: "انتقال همهٔ خرج‌ها" }),
    ).not.toBeInTheDocument();
  });
});
