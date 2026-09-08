"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryDot } from "./category-color";
import { api } from "@/lib/api/client";
import { toPersianDigits } from "@/lib/jalali";
import type { CategoryDto } from "@/lib/schemas";
import type { Category } from "@/lib/services";

// The categories page's island (ticket 28): the full manage flow over the
// typed v1 client — create with a color swatch, free rename (system ones
// included), the delete guard (a used category's delete is disabled with
// its count spoken; the «انتقال همهٔ خرج‌ها» shortcut moves first, then
// deletes the emptied category — decision 05). Rows follow the ledger's
// ruled anatomy; every failure speaks once, generically, and keeps what
// was typed.

const SWATCHES: Array<{ hex: string; name: string }> = [
  { hex: "#1a7a5c", name: "یشمی" },
  { hex: "#3da3c4", name: "فیروزه‌ای" },
  { hex: "#3d7fc4", name: "آبی" },
  { hex: "#7a5fc4", name: "بنفش" },
  { hex: "#c4559b", name: "سرخابی" },
  { hex: "#c47a3d", name: "نارنجی" },
  { hex: "#b3402e", name: "آجری" },
  { hex: "#82887e", name: "خاکستری" },
];

const BTN_GHOST =
  "rounded-full border border-rule px-5 py-2.5 text-[14px] font-semibold text-ink-muted hover:text-ink";
const BTN_PRIMARY =
  "rounded-full bg-accent px-6 py-2.5 text-[14px] font-semibold text-white hover:brightness-110 disabled:opacity-60";
const BTN_DANGER =
  "rounded-full bg-danger px-6 py-2.5 text-[14px] font-semibold text-white hover:brightness-110 disabled:opacity-60";
const INPUT_CLASS =
  "w-full border-0 border-b border-rule bg-transparent py-2 text-[15.5px] outline-none";

/** The v1 client answers with DTO rows (ISO string timestamps); the local
 * state keeps the service's Date shape — convert at this one edge. */
function toRow(dto: CategoryDto): Category {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

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
  const [color, setColor] = useState(SWATCHES[0]!.hex);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expenseCount = (id: string) => expenseCounts[id] ?? 0;
  const templateCount = (id: string) => templateCounts[id] ?? 0;

  /** One voice for every failed mutation; the page keeps its state. */
  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await action();
    } catch {
      setError("انجام نشد؛ دوباره تلاش کنید.");
    } finally {
      setPending(false);
    }
  }

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
      setRows((prev) => [...prev, toRow(created)]);
      setFormOpen(false);
      setName("");
      setColor(SWATCHES[0]!.hex);
      router.refresh();
    });

  const rename = (id: string) =>
    run(async () => {
      const updated = await api.categories.update(id, { name: editName.trim() });
      replaceRow(toRow(updated));
      setEditingId(null);
      router.refresh();
    });

  const removeCategory = (id: string) =>
    run(async () => {
      await api.categories.remove(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      setConfirmingId(null);
      router.refresh();
    });

  const moveAndRemove = (id: string) =>
    run(async () => {
      if (moveTarget === null) return;
      await api.categories.moveExpenses(id, { targetCategoryId: moveTarget });
      await api.categories.remove(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      setMovingId(null);
      router.refresh();
    });

  return (
    <>
      <ul className="mt-4 border-t-2 border-ink">
        {rows.map((category) => {
          const expenses = expenseCount(category.id);
          const templates = templateCount(category.id);
          const used = expenses + templates > 0;
          const usage =
            category.kind === "system"
              ? "دستهٔ سیستمی"
              : [expenses > 0 ? `${toPersianDigits(expenses)} خرج` : null,
                 templates > 0 ? `${toPersianDigits(templates)} الگو` : null]
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
                    انتقال همهٔ خرج‌ها و الگوهای {category.name} به…
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
                  <span className="ms-auto flex items-center gap-3 text-[12.5px]">
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
                      (used ? (
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
            {SWATCHES.map((swatch) => (
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
