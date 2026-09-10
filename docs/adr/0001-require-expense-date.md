# Every expense has an occurrence date

Undated expenses («بدون تاریخ») let a row belong to a Jalali month without a day. That split the month-assignment rule (dated → date, undated → form month), the ledger, the sheet, and search/insights. We dropped it: the user always enters a date, and `monthKey` is always derived from `occurredAt`. Existing undated rows were backfilled to the first Jalali day of the month they already belonged to — the day is an assigned default, not a remembered purchase day.
