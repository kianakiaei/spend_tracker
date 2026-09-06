import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { expenses } from "@/db/schema";
import { newId } from "@/lib/id";
import { createCategoryService } from "@/lib/services/category-service";
import {
  CategoryInUseError,
  DuplicateCategoryNameError,
  NotFoundError,
  SystemCategoryProtectedError,
  ValidationError,
} from "@/lib/services/errors";
import { setupIntegrationDb } from "../helpers/integration";

// Category service rules on a real temp libSQL file (ticket 22): FKs are
// off, so "no deleting a category that has expenses" and "system categories
// are undeletable" must hold here, plus per-user name uniqueness and the
// bulk move.

const fx = await setupIntegrationDb("category-service");
const service = createCategoryService(fx.db);

afterAll(async () => {
  await fx.close();
});

function insertExpense(userId: string, categoryId: string, monthKey = "1405-06") {
  const now = new Date();
  return fx.db.insert(expenses).values({
    id: newId(),
    amountToman: 10_000,
    title: "نان بربری",
    categoryId,
    monthKey,
    userId,
    createdAt: now,
    updatedAt: now,
  });
}

describe("categoryService — list/create (ticket 22)", () => {
  it("lists the six seeded system categories in order for a fresh user", async () => {
    const userId = await fx.signUp();

    const list = await service.list(userId);

    expect(list.map((c) => c.slug)).toEqual([
      "groceries",
      "cafe-restaurant",
      "transport",
      "health-beauty",
      "installment",
      "bills-internet",
    ]);
    expect(list.every((c) => c.kind === "system")).toBe(true);
  });

  it("creates a custom category stacked after the system seeds", async () => {
    const userId = await fx.signUp();

    const created = await service.create(userId, {
      name: "هدیه",
      color: "#ff0000",
    });

    expect(created.kind).toBe("custom");
    expect(created.slug).toBeNull();
    expect(created.order).toBe(6);
    expect(created.color).toBe("#ff0000");
    expect(created.icon).toBeNull();
    const list = await service.list(userId);
    expect(list.at(-1)?.name).toBe("هدیه");
  });

  it("refuses a duplicate name per user — on create and on rename — but allows it across users", async () => {
    const userId = await fx.signUp();
    await service.create(userId, { name: "ورزش" });
    const other = await service.create(userId, { name: "سرگرمی" });

    await expect(service.create(userId, { name: "ورزش" })).rejects.toThrow(
      DuplicateCategoryNameError,
    );
    await expect(
      service.update(userId, other.id, { name: "ورزش" }),
    ).rejects.toThrow(DuplicateCategoryNameError);
    // renaming to its own (unchanged) name is fine
    await expect(
      service.update(userId, other.id, { name: "سرگرمی" }),
    ).resolves.toMatchObject({ name: "سرگرمی" });

    const otherUser = await fx.signUp();
    await expect(service.create(otherUser, { name: "ورزش" })).resolves.toBeTruthy();
  });

  it("renames a system category freely; kind stays system; clearing color works", async () => {
    const userId = await fx.signUp();
    const groceries = (await service.list(userId)).find(
      (c) => c.slug === "groceries",
    )!;

    const renamed = await service.update(userId, groceries.id, {
      name: "خوراکی خانه",
      color: null,
    });

    expect(renamed.name).toBe("خوراکی خانه");
    expect(renamed.kind).toBe("system");
    expect(renamed.slug).toBe("groceries");
    expect(renamed.color).toBeNull();
  });

  it("rejects invalid ids and unknown/foreign ids with typed errors", async () => {
    const userId = await fx.signUp();
    const foreignUser = await fx.signUp();
    const foreign = await service.create(foreignUser, { name: "بیگانه" });

    await expect(service.get(userId, "not-a-uuid")).rejects.toThrow(
      ValidationError,
    );
    await expect(service.get(userId, newId())).rejects.toThrow(NotFoundError);
    await expect(service.get(userId, foreign.id)).rejects.toThrow(NotFoundError);
    await expect(
      service.update(userId, foreign.id, { name: "تصاحب" }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("categoryService — delete rules (ticket 22: 409 in the handler)", () => {
  it("refuses to delete a system category even when it has expenses", async () => {
    const userId = await fx.signUp();
    const groceries = (await service.list(userId)).find(
      (c) => c.slug === "groceries",
    )!;
    await insertExpense(userId, groceries.id);

    await expect(service.remove(userId, groceries.id)).rejects.toThrow(
      SystemCategoryProtectedError,
    );
    await expect(service.get(userId, groceries.id)).resolves.toBeTruthy();
  });

  it("refuses to delete a custom category that still has expenses, leaving it and them intact", async () => {
    const userId = await fx.signUp();
    const custom = await service.create(userId, { name: "کتاب" });
    await insertExpense(userId, custom.id);

    await expect(service.remove(userId, custom.id)).rejects.toThrow(
      CategoryInUseError,
    );
    await expect(service.get(userId, custom.id)).resolves.toBeTruthy();
    const rows = await fx.db
      .select()
      .from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.categoryId, custom.id)));
    expect(rows).toHaveLength(1);
  });

  it("deletes an empty custom category", async () => {
    const userId = await fx.signUp();
    const custom = await service.create(userId, { name: "متفرقه" });

    await expect(service.remove(userId, custom.id)).resolves.toBeUndefined();
    await expect(service.get(userId, custom.id)).rejects.toThrow(NotFoundError);
  });
});

describe("categoryService — moveExpenses (ticket 22)", () => {
  it("really moves every expense to the target and reports the count", async () => {
    const userId = await fx.signUp();
    const groceries = (await service.list(userId)).find(
      (c) => c.slug === "groceries",
    )!;
    const source = await service.create(userId, { name: "ورزش" });
    const target = await service.create(userId, { name: "حیوان خانگی" });
    await insertExpense(userId, source.id);
    await insertExpense(userId, source.id);
    await insertExpense(userId, groceries.id);

    const { moved } = await service.moveExpenses(userId, source.id, target.id);

    expect(moved).toBe(2);
    const rows = await fx.db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId));
    expect(rows.filter((e) => e.categoryId === target.id)).toHaveLength(2);
    expect(rows.filter((e) => e.categoryId === groceries.id)).toHaveLength(1);
    // the emptied source stays (it is not auto-deleted) — and is now deletable
    await expect(service.get(userId, source.id)).resolves.toBeTruthy();
    await expect(service.remove(userId, source.id)).resolves.toBeUndefined();
  });

  it("refuses unknown, foreign and self targets", async () => {
    const userId = await fx.signUp();
    const source = await service.create(userId, { name: "مبدأ" });

    await expect(
      service.moveExpenses(userId, source.id, newId()),
    ).rejects.toThrow(NotFoundError);
    await expect(
      service.moveExpenses(userId, source.id, source.id),
    ).rejects.toThrow(ValidationError);
  });
});
