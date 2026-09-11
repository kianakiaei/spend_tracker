"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRun } from "./ui/use-run";
import { toEventRow } from "./ui/client-row";
import { api } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { toPersianDigits } from "@/lib/jalali";
import type { EventRow } from "@/lib/services";
import { BTN_GHOST, BTN_PRIMARY, INPUT_CLASS } from "./ui/style";

// The events page's island: create + rename + delete (delete unlinks only).

export function EventsManager({
  initialEvents,
  summaries,
}: {
  initialEvents: EventRow[];
  summaries: Record<string, { totalToman: number; count: number }>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialEvents);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { run, pending, error } = useRun();

  function replaceRow(updated: EventRow) {
    setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }

  const create = () =>
    run(async () => {
      const created = await api.events.create({
        title: title.trim(),
        note: note.trim() === "" ? null : note.trim(),
      });
      setRows((prev) => [...prev, toEventRow(created)]);
      setFormOpen(false);
      setTitle("");
      setNote("");
      router.refresh();
    }, "انجام نشد؛ دوباره تلاش کنید.");

  const rename = (id: string) =>
    run(async () => {
      const updated = await api.events.update(id, { title: editTitle.trim() });
      replaceRow(toEventRow(updated));
      setEditingId(null);
      router.refresh();
    }, "انجام نشد؛ دوباره تلاش کنید.");

  const removeEvent = (id: string) =>
    run(async () => {
      await api.events.remove(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      setConfirmingId(null);
      router.refresh();
    }, "انجام نشد؛ دوباره تلاش کنید.");

  return (
    <>
      {rows.length === 0 && !formOpen ? (
        <p className="py-10 text-center text-[14.5px] leading-8 text-ink-muted">
          هنوز رویدادی نیست. برای سفر یا مناسبت بعدی یکی بسازید.
        </p>
      ) : (
        <ul className="mt-4">
          {rows.map((event) => {
            const summary = summaries[event.id] ?? { totalToman: 0, count: 0 };
            return (
              <li key={event.id} className="border-b border-rule py-2">
                {editingId === event.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void rename(event.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      aria-label="نام رویداد"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className={INPUT_CLASS}
                    />
                    <button
                      type="submit"
                      disabled={editTitle.trim() === "" || pending}
                      className={BTN_PRIMARY}
                    >
                      ذخیره
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className={BTN_GHOST}
                    >
                      انصراف
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <a
                      href={`/events/${event.id}`}
                      className="flex min-w-0 flex-1 flex-col gap-0.5 text-right hover:text-accent"
                    >
                      <span className="truncate text-[15px] font-bold">
                        {event.title}
                      </span>
                      <span className="text-[12px] text-ink-muted">
                        {toPersianDigits(summary.count)} خرج ·{" "}
                        {formatNumber(summary.totalToman)} تومان
                      </span>
                    </a>
                    <span className="flex shrink-0 items-center gap-3 text-[12.5px]">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(event.id);
                          setEditTitle(event.title);
                        }}
                        className="text-accent hover:underline"
                      >
                        تغییر نام
                      </button>
                      {confirmingId === event.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-ink-muted">
                            حذف شود؟ خرج‌ها می‌مانند.
                          </span>
                          <button
                            type="button"
                            onClick={() => void removeEvent(event.id)}
                            disabled={pending}
                            className="text-danger hover:underline"
                          >
                            حذف
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="text-ink-muted hover:underline"
                          >
                            انصراف
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(event.id)}
                          className="text-danger hover:underline"
                        >
                          حذف
                        </button>
                      )}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      )}
      {formOpen ? (
        <form
          className="mt-4 border-t border-rule pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div>
            <label
              htmlFor="new-event-title"
              className="mb-1.5 block text-[12px] text-ink-muted"
            >
              نام رویداد
            </label>
            <input
              id="new-event-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثلاً سفر اصفهان"
              className={INPUT_CLASS}
            />
          </div>
          <div className="mt-3">
            <label
              htmlFor="new-event-note"
              className="mb-1.5 block text-[12px] text-ink-muted"
            >
              یادداشت (اختیاری)
            </label>
            <input
              id="new-event-note"
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="مثلاً سه روزه با خانواده"
              className={INPUT_CLASS}
            />
          </div>
          <div className="mt-4 flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className={`${BTN_GHOST} me-auto`}
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={title.trim() === "" || pending}
              aria-busy={pending || undefined}
              className={BTN_PRIMARY}
            >
              افزودن
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          aria-label="افزودن رویداد"
          onClick={() => setFormOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-rule-strong bg-panel px-4 py-3 text-[14px] font-semibold text-accent hover:border-accent"
        >
          + افزودن رویداد
        </button>
      )}
    </>
  );
}


