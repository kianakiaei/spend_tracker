import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TemplatesManager } from "@/components/templates-manager";
import {
  currentJalaliMonthKey,
  currentTehranISODate,
  formatJalali,
  fromISODate,
  fromJalaliMonthKey,
  jalaliDayOfMonth,
  shiftJalaliMonthKey,
  toPersianDigits,
} from "@/lib/jalali";
import type { Category, RecurringTemplate } from "@/lib/services";

// Ticket 28 — the templates page's behavior contract: pause/resume through
// the typed client with the row state flipping, the «خرج این ماه» link to
// the generated expense's category, the future-months preview block, and
// the create/edit sheet (soft amount parse, Jalali day 1..31, today's
// start default, optional end) through the same sheet anatomy.

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const api = vi.hoisted(() => ({
  recurringTemplates: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
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
const INSTALLMENT: Category = { ...GROCERIES, id: "01900000-0000-7000-8000-000000000003", name: "قسط", slug: "installment", order: 4, color: "#7a5fc4" };
const CATEGORIES = [GROCERIES, INSTALLMENT];

const LOAN: RecurringTemplate = {
  id: "01900000-0000-7000-8000-000000000101",
  title: "قسط وام",
  amountToman: 1_500_000,
  categoryId: INSTALLMENT.id,
  dayOfMonth: 10,
  startDate: "2025-01-01",
  endDate: null,
  active: true,
  userId: USER,
  createdAt: NOW,
  updatedAt: NOW,
};
const NET: RecurringTemplate = {
  ...LOAN,
  id: "01900000-0000-7000-8000-000000000102",
  title: "اینترنت خانه",
  amountToman: 320_000,
  categoryId: GROCERIES.id,
  dayOfMonth: 31,
  endDate: "2026-12-29",
  active: false,
};

const CURRENT = currentJalaliMonthKey();
const NEXT = shiftJalaliMonthKey(CURRENT, 1);
const NEXT_MONTH_NAME = formatJalali(fromJalaliMonthKey(NEXT), "MMMM");

function renderManager(over: Partial<Parameters<typeof TemplatesManager>[0]> = {}) {
  return render(
    <TemplatesManager
      initialTemplates={[LOAN, NET]}
      categories={CATEGORIES}
      currentMonthKey={CURRENT}
      generatedThisMonth={{ [LOAN.id]: "01900000-0000-7000-8000-000000000201" }}
      previewMonths={[
        {
          monthKey: NEXT,
          rows: [
            {
              templateId: LOAN.id,
              title: LOAN.title,
              amountToman: LOAN.amountToman,
              categoryId: LOAN.categoryId,
              day: 10,
            },
          ],
        },
      ]}
      {...over}
    />,
  );
}

function rowOf(name: string) {
  const list = screen.getByRole("list", { name: "الگوهای تکرار" });
  return within(list).getByText(name).closest("li")!;
}

beforeEach(() => {
  refresh.mockClear();
  api.recurringTemplates.create.mockReset();
  api.recurringTemplates.update.mockReset();
  api.recurringTemplates.remove.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the list", () => {
  it("renders each template's rhythm and marks the paused one", () => {
    renderManager();

    const list = screen.getByRole("list", { name: "الگوهای تکرار" });
    expect(within(list).getByText("قسط وام")).toBeInTheDocument();
    expect(within(list).getByText("متوقف")).toBeInTheDocument();
    expect(within(list).getAllByText(/هر ماه/)).toHaveLength(2);
  });

  it("pauses and resumes through the client, flipping the row", async () => {
    api.recurringTemplates.update
      .mockResolvedValueOnce({ ...LOAN, active: false })
      .mockResolvedValueOnce({ ...NET, active: true });
    renderManager();

    fireEvent.click(within(rowOf("قسط وام")).getByRole("button", { name: "توقف" }));
    await waitFor(() =>
      expect(api.recurringTemplates.update).toHaveBeenCalledWith(LOAN.id, {
        active: false,
      }),
    );
    expect(within(rowOf("قسط وام")).getByText("متوقف")).toBeInTheDocument();

    fireEvent.click(within(rowOf("اینترنت خانه")).getByRole("button", { name: "ازسرگیری" }));
    await waitFor(() =>
      expect(api.recurringTemplates.update).toHaveBeenCalledWith(NET.id, {
        active: true,
      }),
    );
    expect(screen.getAllByText("متوقف")).toHaveLength(1);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("deep-links a template that generated this month to that expense's edit sheet", () => {
    renderManager();

    const link = within(rowOf("قسط وام")).getByRole("link", {
      name: "خرج این ماه تولید شد",
    });
    expect(link).toHaveAttribute(
      "href",
      `/?month=${CURRENT}&expense=01900000-0000-7000-8000-000000000201`,
    );
    // the paused one generated nothing
    expect(
      within(rowOf("اینترنت خانه")).queryByRole("link", {
        name: "خرج این ماه تولید شد",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows the future-months preview with clamped days and the badge", () => {
    renderManager();

    expect(screen.getByText("پیش‌بینی ماه‌های آینده")).toBeInTheDocument();
    expect(
      screen.getByText(`${toPersianDigits(10)} ${NEXT_MONTH_NAME}`),
    ).toBeInTheDocument();
    expect(screen.getAllByText("پیش‌بینی").length).toBeGreaterThan(0);
  });
});

describe("create sheet", () => {
  it("saves a new template through the client with today's start default", async () => {
    api.recurringTemplates.create.mockResolvedValue({
      ...LOAN,
      id: "01900000-0000-7000-8000-000000000103",
      title: "شارژ ماهانه",
    });
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "افزودن الگو" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "شارژ ماهانه" },
    });
    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "200000" },
    });
    fireEvent.change(screen.getByLabelText("روز ماه"), {
      target: { value: "15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "قسط" }));
    fireEvent.click(screen.getByRole("button", { name: "ثبت" }));

    await waitFor(() =>
      expect(api.recurringTemplates.create).toHaveBeenCalledWith({
        amountToman: 200000,
        title: "شارژ ماهانه",
        categoryId: INSTALLMENT.id,
        dayOfMonth: 15,
        startDate: currentTehranISODate(),
        endDate: null,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByText("شارژ ماهانه")).toBeInTheDocument();
  });

  it("defaults the day to today's Jalali day and refuses day 32", async () => {
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "افزودن الگو" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // a number input's value is a number in the DOM
    expect(screen.getByLabelText("روز ماه")).toHaveValue(
      jalaliDayOfMonth(fromISODate(currentTehranISODate())),
    );

    fireEvent.change(screen.getByLabelText("عنوان"), {
      target: { value: "تست" },
    });
    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText("روز ماه"), {
      target: { value: "32" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ثبت" }));

    expect(api.recurringTemplates.create).not.toHaveBeenCalled();
  });
});

describe("edit sheet", () => {
  it("opens prefilled and patches through the client", async () => {
    api.recurringTemplates.update.mockResolvedValue({
      ...LOAN,
      amountToman: 1_600_000,
    });
    renderManager();

    fireEvent.click(within(rowOf("قسط وام")).getByRole("button", { name: "ویرایش" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("عنوان")).toHaveValue("قسط وام");
    expect(screen.getByLabelText("مبلغ")).toHaveValue("1500000");
    expect(screen.getByLabelText("روز ماه")).toHaveValue(10);

    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "1600000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    await waitFor(() =>
      expect(api.recurringTemplates.update).toHaveBeenCalledWith(LOAN.id, {
        amountToman: 1_600_000,
        title: "قسط وام",
        categoryId: LOAN.categoryId,
        dayOfMonth: 10,
        startDate: "2025-01-01",
        endDate: null,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("keeps every field and speaks generically when the save fails", async () => {
    api.recurringTemplates.update.mockRejectedValueOnce(
      new TypeError("network down"),
    );
    renderManager();

    fireEvent.click(within(rowOf("قسط وام")).getByRole("button", { name: "ویرایش" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("مبلغ"), {
      target: { value: "1600000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ذخیره نشد؛ دوباره تلاش کنید.",
    );
    expect(screen.getByLabelText("مبلغ")).toHaveValue("1600000");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("the ?edit= deep-link (decision 15: forecast row → edit sheet)", () => {
  it("opens that template's edit sheet once, then strips itself", async () => {
    render(
      <TemplatesManager
        initialTemplates={[LOAN, NET]}
        categories={CATEGORIES}
        currentMonthKey={CURRENT}
        generatedThisMonth={{}}
        previewMonths={[]}
        initialEditId={LOAN.id}
      />,
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("عنوان")).toHaveValue("قسط وام");
    // one-shot: the param is gone from the address
    await waitFor(() =>
      expect(window.location.search).not.toContain("edit="),
    );

    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("an unknown id opens nothing", () => {
    render(
      <TemplatesManager
        initialTemplates={[LOAN, NET]}
        categories={CATEGORIES}
        currentMonthKey={CURRENT}
        generatedThisMonth={{}}
        previewMonths={[]}
        initialEditId="not-a-template"
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
