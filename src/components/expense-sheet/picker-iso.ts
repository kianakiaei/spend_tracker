import DateObject from "react-date-object";
import gregorian from "react-date-object/calendars/gregorian";

// Picker → stored Gregorian date-only string. Clone before convert: DateObject.convert
// mutates the picker's own object (and would flip the calendar to Gregorian).
// Calendar parts, not Date#toDate(): a JS Date is timezone-local, so the
// sheet subtitle can name the previous Jalali month after a TZ change.

export function isoDateFromPicker(value: DateObject): string {
  const g = new DateObject(value).convert(gregorian);
  const year = String(g.year).padStart(4, "0");
  const month = String(g.month.number).padStart(2, "0");
  const day = String(g.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
