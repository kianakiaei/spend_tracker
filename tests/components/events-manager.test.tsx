import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EventsManager } from "@/components/events-manager";
import type { EventRow } from "@/lib/services";

// Ticket: events page behavior — create a named bucket (رویداد), free
// rename, delete behind an inline confirm (delete unlinks only), and the
// row's overlay total (تعداد + مبلغ).

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

const api = vi.hoisted(() => ({
  events: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/api/client", () => ({ api }));

const NOW = new Date(2026, 8, 6, 12, 0);
const USER = "01900000-0000-7000-8000-0000000000ff";

function eventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "01900000-0000-7000-8000-000000000201",
    title: "سفر اصفهان",
    note: null,
    startDate: null,
    endDate: null,
    userId: USER,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const EVENTS: EventRow[] = [
  eventRow(),
  eventRow({ id: "01900000-0000-7000-8000-000000000202", title: "سفر مشهد" }),
];
const SUMMARIES = {
  [EVENTS[0]!.id]: { totalToman: 150_000, count: 2 },
  [EVENTS[1]!.id]: { totalToman: 0, count: 0 },
};

function renderManager() {
  return render(
    <EventsManager initialEvents={EVENTS} summaries={SUMMARIES} />,
  );
}

beforeEach(() => {
  refresh.mockClear();
  api.events.create.mockReset();
  api.events.update.mockReset();
  api.events.remove.mockReset();
});

describe("EventsManager", () => {
  it("lists events with their overlay totals", () => {
    renderManager();
    expect(screen.getByText("سفر اصفهان")).toBeInTheDocument();
    expect(screen.getByText("۲ خرج · ۱۵۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(screen.getByText("سفر مشهد")).toBeInTheDocument();
  });

  it("creates an event through the typed client", async () => {
    const created = eventRow({
      id: "01900000-0000-7000-8000-000000000203",
      title: "عروسی",
    });
    api.events.create.mockResolvedValue(created);
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: "افزودن رویداد" }));
    fireEvent.change(screen.getByLabelText("نام رویداد"), {
      target: { value: "عروسی" },
    });
    fireEvent.click(screen.getByRole("button", { name: "افزودن" }));

    await waitFor(() =>
      expect(api.events.create).toHaveBeenCalledWith({
        title: "عروسی",
        note: null,
      }),
    );
    expect(await screen.findByText("عروسی")).toBeInTheDocument();
  });

  it("renames an event", async () => {
    const updated = eventRow({ title: "سفر اصفهان و کاشان" });
    api.events.update.mockResolvedValue(updated);
    renderManager();

    const firstRow = within(screen.getByText("سفر اصفهان").closest("li")!);
    fireEvent.click(firstRow.getByRole("button", { name: "تغییر نام" }));
    fireEvent.change(screen.getByLabelText("نام رویداد"), {
      target: { value: "سفر اصفهان و کاشان" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));

    await waitFor(() =>
      expect(api.events.update).toHaveBeenCalledWith(EVENTS[0]!.id, {
        title: "سفر اصفهان و کاشان",
      }),
    );
    expect(
      await screen.findByText("سفر اصفهان و کاشان"),
    ).toBeInTheDocument();
  });

  it("deletes an event behind an inline confirm", async () => {
    renderManager();
    const firstRow = within(screen.getByText("سفر اصفهان").closest("li")!);
    fireEvent.click(firstRow.getByRole("button", { name: "حذف" }));
    fireEvent.click(firstRow.getByRole("button", { name: "حذف" }));

    await waitFor(() =>
      expect(api.events.remove).toHaveBeenCalledWith(EVENTS[0]!.id),
    );
    expect(screen.queryByText("سفر اصفهان")).not.toBeInTheDocument();
  });
});