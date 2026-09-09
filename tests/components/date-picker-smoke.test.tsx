import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DatePicker from "react-multi-date-picker";
// react-date-object is a transitive dep of react-multi-date-picker; these two
// imports are the docs-prescribed way to select the OFFICIAL persian calendar
// (never `jalali` — it can differ by a day, research 04). Real form use comes
// with ticket 27; this smoke only pins React 19 compatibility (ticket 20).
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

describe("react-multi-date-picker on React 19 (smoke)", () => {
  it("renders a Gregorian state value as a Jalali, Persian-digit input", () => {
    render(
      <DatePicker
        value={new Date(2026, 8, 6)} // 1405-06-15
        calendar={persian}
        locale={persian_fa}
      />,
    );
    expect(screen.getByDisplayValue("۱۴۰۵/۰۶/۱۵")).toBeInTheDocument();
  });

  it("without portal the popper stays inside a clipping sheet container", () => {
    // Documents the bug: SheetPanel scrolls with overflow-auto, so an
    // inline calendar gets cropped by the panel.
    render(
      <div data-testid="clip" style={{ overflow: "auto" }}>
        <DatePicker calendar={persian} locale={persian_fa} />
      </div>,
    );
    fireEvent.click(screen.getByRole("textbox"));
    const holder = screen
      .getByTestId("clip")
      .querySelector("div[style*='absolute']");
    expect(holder).not.toBeNull();
  });

  it("with portal the popper escapes the clipping sheet container", () => {
    // Every app picker passes `portal`, so the calendar renders at
    // document.body — outside any overflow-auto ancestor.
    render(
      <div data-testid="clip" style={{ overflow: "auto" }}>
        <DatePicker portal calendar={persian} locale={persian_fa} />
      </div>,
    );
    fireEvent.click(screen.getByRole("textbox"));
    expect(
      screen.getByTestId("clip").querySelector("div[style*='absolute']"),
    ).toBeNull();
    expect(
      document.body.querySelector("div[style*='absolute']"),
    ).not.toBeNull();
  });
});
