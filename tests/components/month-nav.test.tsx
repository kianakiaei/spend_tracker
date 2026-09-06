import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MonthNav } from "@/components/month-nav";

// The one critical client component of ticket 26: it owns month navigation —
// the arrows must push the shifted ?month= key (shiftJalaliMonthKey's own
// arithmetic is unit-tested in tests/unit/jalali.test.ts).

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("MonthNav", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("shows the jalali month label", () => {
    render(<MonthNav monthKey="1405-06" label="شهریور ۱۴۰۵" />);
    expect(screen.getByText("شهریور ۱۴۰۵")).toBeInTheDocument();
  });

  it("pushes the next and previous month keys", () => {
    render(<MonthNav monthKey="1405-06" label="شهریور ۱۴۰۵" />);
    fireEvent.click(screen.getByRole("button", { name: "ماه بعد" }));
    expect(push).toHaveBeenCalledWith("/?month=1405-07");
    fireEvent.click(screen.getByRole("button", { name: "ماه قبل" }));
    expect(push).toHaveBeenCalledWith("/?month=1405-05");
  });

  it("crosses the year boundary", () => {
    render(<MonthNav monthKey="1405-12" label="اسفند ۱۴۰۵" />);
    fireEvent.click(screen.getByRole("button", { name: "ماه بعد" }));
    expect(push).toHaveBeenCalledWith("/?month=1406-01");
  });
});
