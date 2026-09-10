import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { expenses, learnedKeys } from "@/db/schema";
import { createCategoryService } from "@/lib/services/category-service";
import { createClassifyService } from "@/lib/services/classify-service";
import { createExpenseService } from "@/lib/services/expense-service";
import { ValidationError } from "@/lib/services/errors";
import { setupIntegrationDb } from "../helpers/integration";

// Learning on save + the shared classify service, against real rows
// (ticket 22, rules from ticket 06): every save counts the title's keys
// toward the final category; a save contradicting the engine's suggestion
// also halves the suggested category's counters (×0.5, exact numbers
// asserted); classify = engine → fallback (most-frequent category; first
// system category for a user without history).

const fx = await setupIntegrationDb("learning-classify");
const categories = createCategoryService(fx.db);
const expensesService = createExpenseService(fx.db);
const classifyService = createClassifyService(fx.db);

afterAll(async () => {
  await fx.close();
});

async function systemCategory(userId: string, slug: string): Promise<string> {
  const category = (await categories.list(userId)).find((c) => c.slug === slug);
  if (!category) throw new Error(`system category ${slug} missing`);
  return category.id;
}

async function learnedRows(userId: string) {
  return fx.db
    .select()
    .from(learnedKeys)
    .where(eq(learnedKeys.userId, userId));
}

async function create(
  userId: string,
  title: string,
  slug: string,
  amountToman = 10_000,
) {
  return expensesService.create(
    userId,
    { amountToman, title, categoryId: await systemCategory(userId, slug), occurredAt: "2026-08-23" },
    "1405-06",
  );
}

describe("learning on save (ticket 22 / rules of ticket 06)", () => {
  it("counts the title's normalized keys toward the final category — count++ on every save", async () => {
    const userId = await fx.signUp();

    await create(userId, "قهوه لاته", "cafe-restaurant");
    await create(userId, "قهوه لاته", "cafe-restaurant");

    const rows = await learnedRows(userId);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    // extractKeys("قهوه لاته") = ["قهوه لاته", "قهوه", "لاته"] — the engine's
    // own extraction drives the writes
    expect(byKey.get("قهوه لاته")!.count).toBe(2);
    expect(byKey.get("قهوه")!.count).toBe(2);
    expect(byKey.get("لاته")!.count).toBe(2);
    expect(byKey.get("قهوه لاته")!.categoryId).toBe(
      await systemCategory(userId, "cafe-restaurant"),
    );
    expect(byKey.get("قهوه لاته")!.source).toBe("learned");
  });

  it("a save contradicting the engine halves the suggested category's counters — exact ×0.5 numbers", async () => {
    const userId = await fx.signUp();
    // Stage the engine's vocabulary: three saves containing «نان» toward
    // transport (the first contradicts the lexicon's groceries suggestion,
    // but groceries has no counters yet — a decay over nothing is a no-op).
    await create(userId, "نان", "transport");
    await create(userId, "نان سنگک", "transport");
    await create(userId, "نان", "transport");

    let rows = await learnedRows(userId);
    expect(rows.find((r) => r.key === "نان")).toMatchObject({ count: 3 });
    expect(rows.find((r) => r.key === "سنگک")).toMatchObject({ count: 1 });

    // Contradiction: the engine now suggests transport for «نان» (learned
    // count 3), the user saves it as groceries.
    await create(userId, "نان", "groceries");

    rows = await learnedRows(userId);
    // The suggested category halved: 3 → 1.5 (fractional counts ride along)
    expect(rows).toContainEqual(
      expect.objectContaining({ key: "نان", categoryId: expect.any(String), count: 1.5 }),
    );
    // …and the new category counted up: 0 → 1. Sibling counters under ONE key
    // are exactly what the widened (userId, key, categoryId) PK allows.
    const groceriesRow = rows.find((r) => r.key === "نان" && r.count === 1);
    expect(groceriesRow!.categoryId).toBe(await systemCategory(userId, "groceries"));
    expect(rows.find((r) => r.key === "سنگک")).toMatchObject({ count: 1 });
    // two rows under the same key «نان»:
    expect(rows.filter((r) => r.key === "نان")).toHaveLength(2);
  });

  it("no contradiction → no decay; learning fires on category-changing updates too", async () => {
    const userId = await fx.signUp();
    const cafe = await systemCategory(userId, "cafe-restaurant");
    const transport = await systemCategory(userId, "transport");

    // «کافه» → cafe-restaurant matches the lexicon: suggestion == final
    await create(userId, "کافه", "cafe-restaurant");
    let rows = await learnedRows(userId);
    expect(rows.find((r) => r.key === "کافه")).toMatchObject({ count: 1 });
    expect(rows).toHaveLength(1); // nothing decayed, nothing else counted

    // Editing the expense to transport counts its keys toward transport —
    // with a contradiction (engine suggests cafe): cafe 1 → 0.5.
    const [expense] = await expensesService.listByMonth(userId, "1405-06");
    await expensesService.update(userId, expense!.id, { categoryId: transport });

    rows = await learnedRows(userId);
    expect(rows.find((r) => r.key === "کافه" && r.categoryId === cafe))
      .toMatchObject({ count: 0.5 });
    expect(rows.find((r) => r.key === "کافه" && r.categoryId === transport))
      .toMatchObject({ count: 1 });
  });
});

describe("classify service (ticket 22 / contract of ticket 12)", () => {
  it("answers from the system lexicon with slug-resolved category ids", async () => {
    const userId = await fx.signUp();

    const result = await classifyService.classify(userId, "اسنپ فود");

    expect(result.source).toBe("system");
    expect(result.matchedKey).toBe("اسنپ فود");
    expect(result.confidence).toBeNull();
    expect(result.categoryId).toBe(await systemCategory(userId, "cafe-restaurant"));
  });

  it("a learned key outranks the lexicon and reports purity × support", async () => {
    const userId = await fx.signUp();
    // Stage: «نان» transport count 3, then the contradiction save makes it
    // 1.5 vs groceries 1 (see the learning describe above for the rules).
    await create(userId, "نان", "transport");
    await create(userId, "نان سنگک", "transport");
    await create(userId, "نان", "transport");
    await create(userId, "نان", "groceries");

    const result = await classifyService.classify(userId, "نان بربری");

    expect(result.source).toBe("learned");
    expect(result.matchedKey).toBe("نان");
    expect(result.categoryId).toBe(await systemCategory(userId, "transport"));
    // purity = best/total = 1.5 / (1.5 + 1); support = 1.5
    expect(result.confidence).toEqual({ purity: 0.6, support: 1.5 });
  });

  it("falls back to the user's most-frequent category when the ladder has no guess", async () => {
    const userId = await fx.signUp();
    await create(userId, "قرض حسنه", "installment", 100);
    await create(userId, "قرض حسنه دو", "installment", 100);
    await create(userId, "کافه", "cafe-restaurant", 100);

    const result = await classifyService.classify(userId, "ابرقاهوه بی‌معنی");

    expect(result.source).toBe("fallback");
    expect(result.matchedKey).toBeNull();
    expect(result.confidence).toBeNull();
    expect(result.categoryId).toBe(await systemCategory(userId, "installment"));
  });

  it("a user without any expense history falls back to the first system category (خوراکی)", async () => {
    const userId = await fx.signUp();

    const result = await classifyService.classify(userId, "ابرقاهوه بی‌معنی");

    expect(result.source).toBe("fallback");
    expect(result.categoryId).toBe(await systemCategory(userId, "groceries"));
  });

  it("rejects an empty title", async () => {
    const userId = await fx.signUp();
    await expect(classifyService.classify(userId, "   ")).rejects.toThrow(
      ValidationError,
    );
  });

  it("is side-effect free — classification never writes counters", async () => {
    const userId = await fx.signUp();
    await classifyService.classify(userId, "نان");
    await classifyService.classify(userId, "ابرقاهوه");
    expect(await learnedRows(userId)).toHaveLength(0);
    const rows = await fx.db
      .select({ id: expenses.id })
      .from(expenses)
      .where(eq(expenses.userId, userId));
    expect(rows).toHaveLength(0);
  });
});
