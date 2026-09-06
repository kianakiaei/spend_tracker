import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
