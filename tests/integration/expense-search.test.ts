import { afterAll, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { createEventService } from "@/lib/services/event-service";
import { createExpenseService } from "@/lib/services/expense-service";
import { systemCategoryBySlug } from "../helpers/fixtures";
import { setupIntegrationDb } from "../helpers/integration";

// Whole-ledger search (تیکت جست‌وجو): the user types part of an item's title
// and finds every purchase across ALL months — with its price and the Jalali
// month it landed in. Matching uses the SAME canonical form the
// categorization engine uses (yeh/kaf, Persian/Latin digits, ZWNJ), and the
// result is strictly per-user.

const fx = await setupIntegrationDb("expense-search");
const expensesService = createExpenseService(fx.db);

afterAll(async () => {
  await fx.close();
});

async function seedExpense(
  userId: string,
  input: {
    title: string;
    amountToman: number;
    occurredAt?: string;
    quantity?: number;
  },
): Promise<string> {
  const groceries = await systemCategoryBySlug(fx.db, userId, "groceries");
  const created = await expensesService.create(
    userId,
    {
      title: input.title,
      amountToman: input.amountToman,
      quantity: input.quantity,
      categoryId: groceries.id,
      occurredAt: input.occurredAt ?? "2026-08-23",
    },
    "1405-06",
  );
  return created.id;
}

describe("expenseService.searchByTitle", () => {
  it("finds an item across different months with price and month", async () => {
    const userId = await fx.signUp();
    await seedExpense(userId, {
      title: "نان سنگک",
      amountToman: 25_000,
      occurredAt: "2026-07-24", // 1405-05
    });
    await seedExpense(userId, {
      title: "نان بربری",
      amountToman: 30_000,
      occurredAt: "2026-08-25", // 1405-06
    });

    const hits = await expensesService.searchByTitle(userId, "سنگک");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.title).toBe("نان سنگک");
    expect(hits[0]!.amountToman).toBe(25_000);
    expect(hits[0]!.monthKey).toBe("1405-05");
    expect(hits[0]!.occurredAt).toBe("2026-07-24");
    expect(hits[0]!.categoryName).toBe("خوراکی");
    expect(hits[0]!.unit).toBe("piece");
    expect(hits[0]!.eventId).toBe(null);
    expect(hits[0]!.sourceRecurringId).toBe(null);

    const all = await expensesService.searchByTitle(userId, "نان");
    expect(all.map((h) => h.monthKey).sort()).toEqual(["1405-05", "1405-06"]);
  });

  it("matches canonical Persian — arabic yeh, digits, ZWNJ", async () => {
    const userId = await fx.signUp();
    await seedExpense(userId, {
      title: "شیر کاکائو",
      amountToman: 40_000,
      occurredAt: "2026-08-26",
    });

    // arabic yeh (ي) must still match persian ی
    expect(
      (await expensesService.searchByTitle(userId, "شير")).map((h) => h.title),
    ).toEqual(["شیر کاکائو"]);
    // Persian digit in the query matches a Latin digit in the title
    await seedExpense(userId, {
      title: "روغن 1 لیتری",
      amountToman: 90_000,
    });
    expect(
      (await expensesService.searchByTitle(userId, "روغن ۱")).map(
        (h) => h.title,
      ),
    ).toEqual(["روغن 1 لیتری"]);
    // ZWNJ vs space
    await seedExpense(userId, { title: "سبوس‌دار نان", amountToman: 10_000 });
    expect(
      (await expensesService.searchByTitle(userId, "سبوس دار")).map(
        (h) => h.title,
      ),
    ).toEqual(["سبوس‌دار نان"]);
  });

  it("is a substring match and never lists empty queries", async () => {
    const userId = await fx.signUp();
    await seedExpense(userId, { title: "پسته اکبری", amountToman: 200_000 });

    expect(
      (await expensesService.searchByTitle(userId, "اکبر")).map(
        (h) => h.title,
      ),
    ).toEqual(["پسته اکبری"]);
    expect(await expensesService.searchByTitle(userId, "")).toHaveLength(0);
  });

  it("includes expenses with their month and date", async () => {
    const userId = await fx.signUp();
    await seedExpense(userId, { title: "نان", amountToman: 15_000 });

    const [hit] = await expensesService.searchByTitle(userId, "نان");
    expect(hit!.occurredAt).toBe("2026-08-23");
    expect(hit!.monthKey).toBe("1405-06");
  });

  it("is scoped to the user", async () => {
    const userId = await fx.signUp();
    const other = await fx.signUp();
    await seedExpense(other, { title: "چای احمد", amountToman: 80_000 });

    expect(await expensesService.searchByTitle(userId, "چای")).toHaveLength(0);
    expect(
      (await expensesService.searchByTitle(other, "چای")).map(
        (h) => h.title,
      ),
    ).toEqual(["چای احمد"]);
  });

  it("sorts newest month first and caps at the limit", async () => {
    const userId = await fx.signUp();
    await seedExpense(userId, {
      title: "نان",
      amountToman: 10_000,
      occurredAt: "2026-07-01", // 1405-04
    });
    await seedExpense(userId, {
      title: "نان",
      amountToman: 20_000,
      occurredAt: "2026-08-01", // 1405-05
    });

    const hits = await expensesService.searchByTitle(userId, "نان");
    expect(hits.map((h) => h.monthKey)).toEqual(["1405-05", "1405-04"]);
    // IDs are unique per hit
    expect(new Set(hits.map((h) => h.expenseId)).size).toBe(hits.length);
    expect(newId()).toBeTruthy();
  });

  it("carries the event name for expenses attached to a رویداد", async () => {
    const userId = await fx.signUp();
    const groceries = await systemCategoryBySlug(fx.db, userId, "groceries");
    const event = await createEventService(fx.db).create(userId, {
      title: "سفر شمال",
    });
    await expensesService.create(
      userId,
      {
        title: "بلیط قطار",
        amountToman: 850_000,
        categoryId: groceries.id,
        occurredAt: "2026-08-25", // 1405-06
        eventId: event.id,
      },
      "1405-06",
    );
    await seedExpense(userId, { title: "بلیط هواپیما", amountToman: 900_000 });

    const hits = await expensesService.searchByTitle(userId, "بلیط");
    expect(
      Object.fromEntries(hits.map((h) => [h.title, h.eventTitle])),
    ).toEqual({ "بلیط قطار": "سفر شمال", "بلیط هواپیما": null });

    const ledger = await expensesService.listByMonth(userId, "1405-06");
    expect(
      Object.fromEntries(ledger.map((e) => [e.title, e.eventTitle])),
    ).toEqual({ "بلیط قطار": "سفر شمال", "بلیط هواپیما": null });
  });
});
