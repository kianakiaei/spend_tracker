"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryDot } from "./category-color";
import { useRun } from "./ui/use-run";
import { toCategoryRow } from "./ui/client-row";
import { api } from "@/lib/api/client";
import { toPersianDigits } from "@/lib/jalali";
import type { Category } from "@/lib/services";
import { CATEGORY_SWATCHES } from "@/lib/category-palette";
import {
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  INPUT_CLASS,
} from "./ui/style";

// The categories page's island (ticket 28): the full manage flow over the
// typed v1 client — create with a color swatch, free rename (system ones
// included), reorder by swapping with the neighbor, and the delete guard:
// a category with expenses gets a disabled delete plus the «انتقال همهٔ
// خرج‌ها» shortcut (move, then delete the emptied category — decision 05);
// one pointed at by a recurring template has NO shortcut — the move API
// carries expenses only, so the template must be re-pointed first and a
// delete would 409 after the move. Every failure speaks once, generically.

export function CategoriesManager({
  initialCategories,
  expenseCounts,
  templateCounts,
}: {
  initialCategories: Category[];
  expenseCounts: Record<string, number>;
  templateCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialCategories);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_SWATCHES[0].hex);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { run, pending, error } = useRun();

  const expenseCount = (id: string) => expenseCounts[id] ?? 0;
  const templateCount = (id: string) => templateCounts[id] ?? 0;

  function replaceRow(updated: Category) {
    setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }

  const create = () =>
    run(async () => {
      const created = await api.categories.create({
        name: name.trim(),
        color,
        icon: null,
      });
      setRows((prev) => [...prev, toCategoryRow(created)]);
      setFormOpen(false);
      setName("");
      setColor(CATEGORY_SWATCHES[0].hex);
      router.refresh();
    }, "انجام نشد؛ دوباره تلاش کنید.");

  const rename = (id: string) =>
    run(async () => {
      const updated = await api.categories.update(id, { name: editName.trim() });
      replaceRow(toCategoryRow(updated));
      setEditingId(null);
      router.refresh();
    }, "انجام نشد؛ دوباره تلاش کنید.");

  const removeCategory = (id: string) =>
    run(async () => {
      await api.categories.remove(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      setConfirmingId(null);
      router.refresh();
    }, "انجام نشد؛ دوباره تلاش کنید.");

  const moveAndRemove = (id: string) =>
    run(async () => {
      if (moveTarget === null) return;
      await api.categories.moveExpenses(id, { targetCategoryId: moveTarget });
      await api.categories.remove(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      setMovingId(null);
      router.refresh();
    }, "انجام نشد؛ دوباره تلاش کنید.");

  /** Reorder by swapping `order` with the neighbor — the service list is
   * the display order. The local swap happens only after both PATCHes
   * land, so a failed reorder never leaves the list lying. */
  const reorder = (index: number, delta: -1 | 1) =>
    run(async () => {
      const neighbor = rows[index + delta];
      const row = rows[index];
      if (!neighbor || !row) return;
      await api.categories.update(row.id, { order: neighbor.order });
      await api.categories.update(neighbor.id, { order: row.order });
      setRows((prev) => {
        const next = [...prev];
        next[index] = neighbor;
        next[index + delta] = row;
        return next;
      });
      router.refresh();
    }, "ترتیب ذخیره نشد؛ دوباره تلاش می‌شود.");

  return (
    <>
      <ul className="mt-4 border-t-2 border-ink">
        {rows.map((category, index) => {
          const expenses = expenseCount(category.id);
          const templates = templateCount(category.id);
          const hasExpenses = expenses > 0;
          const hasTemplates = templates > 0;
          const usage =
            category.kind === "system"
              ? "دستهٔ سیستمی"
              : [hasExpenses ? `${toPersianDigits(expenses)} خرج` : null,
                 hasTemplates ? `${toPersianDigits(templates)} الگو` : null]
                  .filter(Boolean)
                  .join(" · ") || "خالی";

          return (
            <li key={category.id} className="border-b border-rule">
              {editingId === category.id ? (
                <form
                  className="flex items-center gap-2.5 py-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void rename(category.id);
                  }}
                >
                  <CategoryDot color={category.color} />
                  <input
                    aria-label="نام دسته"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    className={INPUT_CLASS}
                  />
                  <div
                    role="radiogroup"
                    aria-label="رنگ دسته"
                    className="mt-2.5 flex flex-wrap gap-2"
                  >
                    {CATEGORY_SWATCHES.map((swatch) => (
                      <button
                        key={swatch.hex}
                        type="button"
                        role="radio"
                        aria-checked={category.color === swatch.hex}
                        aria-label={swatch.name}
                        title={swatch.name}
                        onClick={() => {
                          api.categories
                            .update(category.id, { color: swatch.hex })
                            .then((updated) => {
                              replaceRow(toCategoryRow(updated));
                            })
                            .catch(() => {
                              // generic error voice is in useRun
                            });
                        }}
                        className={`size-7 rounded-full border-2 ${
                          category.color === swatch.hex
                            ? "border-ink"
                            : "border-transparent hover:border-rule-strong"
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => setEditingId(null)} className={BTN_GHOST}>
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={editName.trim() === "" || pending}
                    className={BTN_PRIMARY}
                  >
                    ذخیره
                  </button>
                </form>
              ) : movingId === category.id ? (
                <div className="py-3">
                  <p className="text-[13.5px]">
                    انتقال همهٔ خرج‌های {category.name} به…
                  </p>
                  <div
                    role="radiogroup"
                    aria-label="دستهٔ مقصد"
                    className="mt-2.5 flex flex-wrap gap-2"
                  >
                    {rows
                      .filter((row) => row.id !== category.id)
                      .map((row) => (
                        <label
                          key={row.id}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rule bg-panel px-3 py-1.5 text-[13px] has-[:checked]:border-accent"
                        >
                          <input
                            type="radio"
                            name="move-target"
                            checked={moveTarget === row.id}
                            onChange={() => setMoveTarget(row.id)}
                            className="sr-only"
                          />
                          <CategoryDot color={row.color} />
                          {row.name}
                        </label>
                      ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMovingId(null)}
                      className={`${BTN_GHOST} me-auto`}
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveAndRemove(category.id)}
                      disabled={moveTarget === null || pending}
                      aria-busy={pending || undefined}
                      className={BTN_DANGER}
                    >
                      انتقال و حذف
                    </button>
                  </div>
                </div>
              ) : confirmingId === category.id ? (
                <div className="flex items-center gap-2.5 py-3">
                  <p className="me-auto text-[13.5px] text-ink-muted">
                    {category.name} حذف شود؟
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className={BTN_GHOST}
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeCategory(category.id)}
                    disabled={pending}
                    aria-busy={pending || undefined}
                    className={BTN_DANGER}
                  >
                    حذف
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 py-3">
                  <CategoryDot color={category.color} />
                  <span className="text-[14.5px] font-semibold">{category.name}</span>
                  <span className="text-[12px] text-ink-muted">{usage}</span>
                  <span className="ms-auto flex shrink-0 items-center gap-3 text-[12.5px]">
                    <span className="flex items-center">
                      <button
                        type="button"
                        aria-label={`${category.name} به بالا`}
                        disabled={index === 0 || pending}
                        onClick={() => void reorder(index, -1)}
                        className="px-0.5 text-[13px] text-ink-muted hover:text-ink disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`${category.name} به پایین`}
                        disabled={index === rows.length - 1 || pending}
                        onClick={() => void reorder(index, 1)}
                        className="px-0.5 text-[13px] text-ink-muted hover:text-ink disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(category.id);
                        setEditName(category.name);
                      }}
                      className="text-accent hover:underline"
                    >
                      ویرایش
                    </button>
                    {category.kind === "custom" &&
                      (hasExpenses || hasTemplates ? (
                        hasTemplates ? (
                          // The move API carries expenses only — a template
                          // still pointing here would 409 the delete after
                          // the move. The template must move first.
                          <button
                            type="button"
                            disabled
                            title="یک الگوی تکرار به این دسته اشاره می‌کند؛ اول دستهٔ الگو را عوض کنید"
                            className="cursor-not-allowed text-ink-muted/60"
                          >
                            حذف
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled
                              title="دستهٔ پُر حذف نمی‌شود؛ اول خرج‌هایش را منتقل کنید"
                              className="cursor-not-allowed text-ink-muted/60"
                            >
                              حذف
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMovingId(category.id);
                                setMoveTarget(null);
                              }}
                              className="text-accent hover:underline"
                            >
                              انتقال همهٔ خرج‌ها
                            </button>
                          </>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(category.id)}
                          className="text-danger hover:underline"
                        >
                          حذف
                        </button>
                      ))}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

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
            <label htmlFor="new-category-name" className="mb-1.5 block text-[12px] text-ink-muted">
              نام دسته
            </label>
            <input
              id="new-category-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثلاً ورزش"
              className={INPUT_CLASS}
            />
          </div>
          <div
            role="radiogroup"
            aria-label="رنگ دسته"
            className="mt-4 flex flex-wrap gap-2"
          >
            {CATEGORY_SWATCHES.map((swatch) => (
              <button
                key={swatch.hex}
                type="button"
                role="radio"
                aria-checked={color === swatch.hex}
                aria-label={swatch.name}
                title={swatch.name}
                onClick={() => setColor(swatch.hex)}
                className={`size-8 rounded-full border-2 ${
                  color === swatch.hex
                    ? "border-ink"
                    : "border-transparent hover:border-rule-strong"
                }`}
                style={{ backgroundColor: swatch.hex }}
              />
            ))}
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
              disabled={name.trim() === "" || pending}
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
          aria-label="افزودن دسته"
          onClick={() => setFormOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-rule-strong bg-panel px-4 py-3 text-[14px] font-semibold text-accent hover:border-accent"
        >
          + افزودن دسته
        </button>
      )}
    </>
  );
}
