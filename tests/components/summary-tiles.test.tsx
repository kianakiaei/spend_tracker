import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SummaryTiles } from "@/components/summary-tiles";
import type { Category, MonthSummary } from "@/lib/services";

const NOW = new Date(2026, 8, 6, 12, 0);

function category(id: string, name: string): Category {
  return {
    id,
    name,
    icon: null,
    color: "#7c5cff",
    kind: "system",
    order: 1,
    slug: null,
    userId: "01900000-0000-7000-8000-0000000000ff",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const CATEGORIES = [
  category("01900000-0000-7000-8000-000000000001", "خوراکی"),
  category("01900000-0000-7000-8000-000000000002", "کافه-رستوران"),
];

const SUMMARY: MonthSummary = {
  monthKey: "1405-02",
  totalToman: 4_160_000,
  byCategory: [
    {
      categoryId: CATEGORIES[1]!.id,
      name: "کافه-رستوران",
      totalToman: 3_914_000,
      count: 2,
    },
    {
      categoryId: CATEGORIES[0]!.id,
      name: "خوراکی",
      totalToman: 246_000,
      count: 1,
    },
  ],
};

describe("SummaryTiles overflow", () => {
  it("keeps long grouped totals inside their tiles", () => {
    render(
      <SummaryTiles monthKey="1405-02" summary={SUMMARY} categories={CATEGORIES} />,
    );

    // 3,914,000 → grouped Persian digits must render…
    const amount = screen.getByText("۳٬۹۱۴٬۰۰۰");
    expect(amount).toBeInTheDocument();
    // …with wrapping allowed so it cannot spill out of the box…
    expect(amount.className).toMatch("break-words");
    // …and every tile shrinks instead of overflowing the grid.
    for (const tile of screen.getAllByRole("link")) {
      expect(tile.className).toMatch("min-w-0");
    }
  });
});
