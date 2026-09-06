import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Contract integration tests of the v1 API (ticket 25): every handler runs
// as an ordinary function of (Request, ctx) against a temp libSQL file +
// migrator, with REAL sessions minted through better-auth (cookie and
// Bearer paths both exercised). This file: the 401 gate, the problem+json
// shape, the expenses + categories resources, and classify. The month
// semantics (preview/forecast/summaries) live in api-v1-months.test.ts.

const dbUrl = `file:${join(tmpdir(), `api-v1-contract-${randomUUID()}.db`)}`;
process.env.TURSO_DATABASE_URL = dbUrl;

const { db } = await import("@/db");
const { auth } = await import("@/lib/auth");
const { migrate } = await import("drizzle-orm/libsql/migrator");
await migrate(db, { migrationsFolder: "./drizzle" });

const expensesRoute = await import("@/app/api/v1/expenses/route");
const expenseIdRoute = await import("@/app/api/v1/expenses/[id]/route");
const categoriesRoute = await import("@/app/api/v1/categories/route");
const categoryIdRoute = await import("@/app/api/v1/categories/[id]/route");
const moveExpensesRoute = await import(
  "@/app/api/v1/categories/[id]/move-expenses/route"
);
const classifyRoute = await import("@/app/api/v1/classify/route");

const { systemCategoryBySlug, relativeMonthKeys } = await import(
  "../helpers/fixtures"
);
const { CURRENT, PREV } = relativeMonthKeys();

const ORIGIN = "http://localhost:3000";

interface Session {
  userId: string;
  token: string;
  cookie: string;
}

/** A real account through better-auth's own mount: session token (Bearer)
 * plus the session cookie, both ready for the handlers. */
async function signUp(): Promise<Session> {
  const res = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "کاربر قرارداد",
        email: `contract-${randomUUID()}@example.com`,
        password: "test-password-123",
      }),
    }),
  );
  expect(res.status).toBe(200);
  const body = (await res.json()) as { user?: { id?: string } };
  const token = res.headers.get("set-auth-token");
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  expect(token, "bearer plugin must expose set-auth-token").toBeTruthy();
  expect(cookie).toContain("session_token");
  return {
    userId: body.user!.id!,
    token: token!,
    cookie,
  };
}

function v1Request(
  path: string,
  init: {
    method?: string;
    session?: Session;
    useBearer?: boolean;
    body?: unknown;
    rawBody?: string;
  } = {},
): Request {
  const headers: Record<string, string> = {};
  if (init.session) {
    if (init.useBearer) {
      headers.authorization = `Bearer ${init.session.token}`;
    } else {
      headers.cookie = init.session.cookie;
    }
  }
  if (init.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  return new Request(`${ORIGIN}/api/v1${path}`, {
    method: init.method ?? "GET",
    headers,
    body:
      init.rawBody ??
      (init.body === undefined ? undefined : JSON.stringify(init.body)),
  });
}

const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

async function expectProblem(
  res: Response,
  status: number,
  type?: string,
): Promise<{
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Array<{ path: string; code: string; message: string }>;
}> {
  expect(res.status).toBe(status);
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  const body = (await res.json()) as {
    type: string;
    title: string;
    status: number;
    detail?: string;
    errors?: Array<{ path: string; code: string; message: string }>;
  };
  expect(body.status).toBe(status);
  expect(typeof body.title).toBe("string");
  if (type) expect(body.type).toBe(`/problems/${type}`);
  return body;
}

const sessionA = await signUp();
const sessionB = await signUp();

afterAll(async () => {
  await db.$client.close();
});

describe("the session gate — 401 problem+json without credentials", () => {
  it("guards every v1 endpoint (cookie and Bearer both missing)", async () => {
    const guarded: Array<() => Promise<Response>> = [
      () => expensesRoute.POST(v1Request("/expenses", { method: "POST" })),
      () => expensesRoute.GET(v1Request("/expenses?month=1404-10")),
      () => expensesRoute.GET(v1Request("/expenses")),
      () => expenseIdRoute.GET(v1Request("/expenses/x"), idCtx("x")),
      () =>
        expenseIdRoute.PATCH(v1Request("/expenses/x", { method: "PATCH" }), idCtx("x")),
      () =>
        expenseIdRoute.DELETE(v1Request("/expenses/x", { method: "DELETE" }), idCtx("x")),
      () => categoriesRoute.GET(v1Request("/categories")),
      () => categoriesRoute.POST(v1Request("/categories", { method: "POST" })),
      () =>
        categoryIdRoute.PATCH(v1Request("/categories/x", { method: "PATCH" }), idCtx("x")),
      () =>
        categoryIdRoute.DELETE(v1Request("/categories/x", { method: "DELETE" }), idCtx("x")),
      () =>
        moveExpensesRoute.POST(
          v1Request("/categories/x/move-expenses", { method: "POST" }),
          idCtx("x"),
        ),
      () => classifyRoute.POST(v1Request("/classify", { method: "POST" })),
    ];

    for (const call of guarded) {
      const res = await call();
      const problem = await expectProblem(res, 401, "unauthorized");
      expect(problem.detail).toBeTruthy();
      expect(problem.errors).toBeUndefined();
    }
  });

  it("rejects a garbage Bearer token with the same 401", async () => {
    const res = await categoriesRoute.GET(
      v1Request("/categories", {
        session: { ...sessionA, token: "not-a-real-token" },
        useBearer: true,
      }),
    );
    await expectProblem(res, 401, "unauthorized");
  });
});

describe("problem+json validation errors", () => {
  it("renders 400 with an errors[] array (path/code/message) for a bad body", async () => {
    const res = await expensesRoute.POST(
      v1Request("/expenses", {
        method: "POST",
        session: sessionA,
        body: {
          amountToman: -5,
          title: "  ",
          categoryId: "nope",
          entryMonthKey: "1405-13",
        },
      }),
    );
    const problem = await expectProblem(res, 400, "validation_failed");
    const paths = (problem.errors ?? []).map((e) => e.path);
    expect(paths).toContain("amountToman");
    expect(paths).toContain("title");
    expect(paths).toContain("categoryId");
    expect(paths).toContain("entryMonthKey");
    for (const entry of problem.errors ?? []) {
      expect(typeof entry.code).toBe("string");
      expect(typeof entry.message).toBe("string");
    }
  });

  it("renders 400 invalid_json for a non-JSON body", async () => {
    const res = await expensesRoute.POST(
      v1Request("/expenses", {
        method: "POST",
        session: sessionA,
        rawBody: "{not json",
      }),
    );
    await expectProblem(res, 400, "invalid_json");
  });

  it("renders 400 with errors[] for a bad query string", async () => {
    const res = await expensesRoute.GET(
      v1Request("/expenses?month=junk", { session: sessionA }),
    );
    const problem = await expectProblem(res, 400, "validation_failed");
    expect((problem.errors ?? []).map((e) => e.path)).toEqual(["month"]);
  });
});

describe("expenses resource", () => {
  it("POST creates a dated expense in its date's month — even when the form's month differs", async () => {
    const groceries = await systemCategoryBySlug(db, sessionA.userId, "groceries");
    const res = await expensesRoute.POST(
      v1Request("/expenses", {
        method: "POST",
        session: sessionA,
        body: {
          amountToman: 25000,
          title: "نان سنگک",
          categoryId: groceries.id,
          occurredAt: "2026-01-15",
          entryMonthKey: CURRENT,
        },
      }),
    );
    expect(res.status).toBe(201);
    const expense = (await res.json()) as {
      id: string;
      monthKey: string;
      occurredAt: string | null;
      amountToman: number;
    };
    // 2026-01-15 = Dey 25, 1404 — the date's month, not the form's.
    expect(expense.monthKey).toBe("1404-10");
    expect(expense.occurredAt).toBe("2026-01-15");
    expect(expense.amountToman).toBe(25000);
    // The create response is the plain row — the joined category shape is
    // GET [id]'s and listByMonth's (asserted below).
  });

  it("POST creates an undated expense as a member of the form's month (ticket 15)", async () => {
    const groceries = await systemCategoryBySlug(db, sessionA.userId, "groceries");
    const res = await expensesRoute.POST(
      v1Request("/expenses", {
        method: "POST",
        session: sessionA,
        body: {
          amountToman: 10000,
          title: "خرید سر کوچه",
          categoryId: groceries.id,
          occurredAt: null,
          entryMonthKey: PREV,
        },
      }),
    );
    expect(res.status).toBe(201);
    const expense = (await res.json()) as { monthKey: string; occurredAt: string | null };
    expect(expense.monthKey).toBe(PREV);
    expect(expense.occurredAt).toBeNull();
  });

  it("GET ?month= lists the month's ledger with each expense's category", async () => {
    const res = await expensesRoute.GET(
      v1Request(`/expenses?month=${encodeURIComponent("1404-10")}`, {
        session: sessionA,
      }),
    );
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{
      id: string;
      monthKey: string;
      category: { slug: string | null };
      userId: string;
    }>;
    const dated = rows.find((row) => row.monthKey === "1404-10");
    expect(dated).toBeDefined();
    expect(dated!.category.slug).toBe("groceries");
    expect(dated!.userId).toBe(sessionA.userId);
  });

  it("GET [id] returns one expense with its category; unknown and foreign ids are 404", async () => {
    const { createExpenseService } = await import("@/lib/services");
    const expense = await createExpenseService(db).create(
      sessionA.userId,
      {
        amountToman: 1000,
        title: "تنها برای خواندن id",
        categoryId: (await systemCategoryBySlug(db, sessionA.userId, "bills-internet")).id,
      },
      CURRENT,
    );

    const ok = await expenseIdRoute.GET(
      v1Request(`/expenses/${expense.id}`, { session: sessionA }),
      idCtx(expense.id),
    );
    expect(ok.status).toBe(200);
    const row = (await ok.json()) as { id: string; category: { id: string } };
    expect(row.id).toBe(expense.id);
    expect(row.category.id).toBe(expense.categoryId);

    const missing = await expenseIdRoute.GET(
      v1Request("/expenses/0198ffff-ffff-7fff-afff-ffffffffffff", {
        session: sessionA,
      }),
      idCtx("0198ffff-ffff-7fff-afff-ffffffffffff"),
    );
    await expectProblem(missing, 404, "not_found");

    const foreign = await expenseIdRoute.GET(
      v1Request(`/expenses/${expense.id}`, { session: sessionB }),
      idCtx(expense.id),
    );
    await expectProblem(foreign, 404, "not_found");
  });

  it("PATCH updates fields and returns the updated row; bad patch is 400", async () => {
    const groceries = await systemCategoryBySlug(db, sessionA.userId, "groceries");
    const { createExpenseService } = await import("@/lib/services");
    const expense = await createExpenseService(db).create(
      sessionA.userId,
      { amountToman: 5000, title: "پیش از ویرایش", categoryId: groceries.id },
      CURRENT,
    );

    const res = await expenseIdRoute.PATCH(
      v1Request(`/expenses/${expense.id}`, {
        method: "PATCH",
        session: sessionA,
        body: { amountToman: 7500, note: "یادداشت شد" },
      }),
      idCtx(expense.id),
    );
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { amountToman: number; note: string | null };
    expect(updated.amountToman).toBe(7500);
    expect(updated.note).toBe("یادداشت شد");

    const empty = await expenseIdRoute.PATCH(
      v1Request(`/expenses/${expense.id}`, {
        method: "PATCH",
        session: sessionA,
        body: {},
      }),
      idCtx(expense.id),
    );
    await expectProblem(empty, 400, "validation_failed");
  });

  it("DELETE removes and the row is gone afterwards", async () => {
    const groceries = await systemCategoryBySlug(db, sessionA.userId, "groceries");
    const { createExpenseService } = await import("@/lib/services");
    const expense = await createExpenseService(db).create(
      sessionA.userId,
      { amountToman: 2000, title: "برای حذف", categoryId: groceries.id },
      CURRENT,
    );

    const res = await expenseIdRoute.DELETE(
      v1Request(`/expenses/${expense.id}`, { method: "DELETE", session: sessionA }),
      idCtx(expense.id),
    );
    expect(res.status).toBe(204);

    const gone = await expenseIdRoute.GET(
      v1Request(`/expenses/${expense.id}`, { session: sessionA }),
      idCtx(expense.id),
    );
    await expectProblem(gone, 404, "not_found");
  });
});

describe("categories resource", () => {
  it("GET lists the six seeded system categories in display order", async () => {
    const res = await categoriesRoute.GET(
      v1Request("/categories", { session: sessionA }),
    );
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{
      id: string;
      name: string;
      kind: string;
      slug: string | null;
      order: number;
      color: string | null;
      icon: string | null;
      userId: string;
      createdAt: string;
    }>;
    expect(rows).toHaveLength(6);
    expect(rows[0]!.slug).toBe("groceries");
    for (const row of rows) {
      expect(row.kind).toBe("system");
      expect(row.userId).toBe(sessionA.userId);
      expect(typeof row.createdAt).toBe("string");
    }
  });

  it("POST creates a custom category and rejects duplicates with 409", async () => {
    const res = await categoriesRoute.POST(
      v1Request("/categories", {
        method: "POST",
        session: sessionA,
        body: { name: "کتاب و لوازم", color: "#1A7A5C", icon: null },
      }),
    );
    expect(res.status).toBe(201);
    const category = (await res.json()) as {
      id: string;
      name: string;
      kind: string;
      color: string | null;
    };
    expect(category.name).toBe("کتاب و لوازم");
    expect(category.kind).toBe("custom");
    expect(category.color).toBe("#1A7A5C");

    const duplicate = await categoriesRoute.POST(
      v1Request("/categories", {
        method: "POST",
        session: sessionA,
        body: { name: "کتاب و لوازم" },
      }),
    );
    await expectProblem(duplicate, 409, "duplicate_category_name");
  });

  it("PATCH renames; DELETE of a used category is 409, of a free one 204, of a system one 409", async () => {
    const created = await categoriesRoute.POST(
      v1Request("/categories", {
        method: "POST",
        session: sessionA,
        body: { name: "هدیه" },
      }),
    );
    const gift = (await created.json()) as { id: string };

    const renamed = await categoryIdRoute.PATCH(
      v1Request(`/categories/${gift.id}`, {
        method: "PATCH",
        session: sessionA,
        body: { name: "هدیه و جشن" },
      }),
      idCtx(gift.id),
    );
    expect(renamed.status).toBe(200);
    expect(((await renamed.json()) as { name: string }).name).toBe("هدیه و جشن");

    const populated = await categoriesRoute.POST(
      v1Request("/categories", {
        method: "POST",
        session: sessionA,
        body: { name: "پر می‌شود" },
      }),
    );
    const busy = (await populated.json()) as { id: string };
    await expensesRoute.POST(
      v1Request("/expenses", {
        method: "POST",
        session: sessionA,
        body: {
          amountToman: 3000,
          title: "ساکن دسته",
          categoryId: busy.id,
          entryMonthKey: CURRENT,
        },
      }),
    );
    const conflict = await categoryIdRoute.DELETE(
      v1Request(`/categories/${busy.id}`, { method: "DELETE", session: sessionA }),
      idCtx(busy.id),
    );
    await expectProblem(conflict, 409, "category_in_use");

    const groceries = await systemCategoryBySlug(db, sessionA.userId, "groceries");
    const system = await categoryIdRoute.DELETE(
      v1Request(`/categories/${groceries.id}`, {
        method: "DELETE",
        session: sessionA,
      }),
      idCtx(groceries.id),
    );
    await expectProblem(system, 409, "system_category_protected");

    const free = await categoryIdRoute.DELETE(
      v1Request(`/categories/${gift.id}`, { method: "DELETE", session: sessionA }),
      idCtx(gift.id),
    );
    expect(free.status).toBe(204);
  });

  it("move-expenses re-points every expense to the target and returns the count", async () => {
    const source = await categoriesRoute.POST(
      v1Request("/categories", {
        method: "POST",
        session: sessionA,
        body: { name: "قبل از انتقال" },
      }),
    );
    const from = (await source.json()) as { id: string };
    const groceries = await systemCategoryBySlug(db, sessionA.userId, "groceries");
    for (const amount of [1000, 2000]) {
      await expensesRoute.POST(
        v1Request("/expenses", {
          method: "POST",
          session: sessionA,
          body: {
            amountToman: amount,
            title: "ساکن انتقال",
            categoryId: from.id,
            entryMonthKey: CURRENT,
          },
        }),
      );
    }

    const res = await moveExpensesRoute.POST(
      v1Request(`/categories/${from.id}/move-expenses`, {
        method: "POST",
        session: sessionA,
        body: { targetCategoryId: groceries.id },
      }),
      idCtx(from.id),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { moved: number }).moved).toBe(2);

    const ledger = await expensesRoute.GET(
      v1Request(`/expenses?month=${encodeURIComponent(CURRENT)}`, {
        session: sessionA,
      }),
    );
    const rows = (await ledger.json()) as Array<{ categoryId: string }>;
    expect(
      rows.filter((row) => row.categoryId === groceries.id).length,
    ).toBeGreaterThanOrEqual(2);
    expect(rows.some((row) => row.categoryId === from.id)).toBe(false);

    const self = await moveExpensesRoute.POST(
      v1Request(`/categories/${groceries.id}/move-expenses`, {
        method: "POST",
        session: sessionA,
        body: { targetCategoryId: groceries.id },
      }),
      idCtx(groceries.id),
    );
    await expectProblem(self, 400, "validation_failed");
  });
});

describe("POST /classify — the side-effect-free suggestion", () => {
  it("falls back to the first system category for a history-less user, always 200", async () => {
    const groceries = await systemCategoryBySlug(db, sessionB.userId, "groceries");
    const res = await classifyRoute.POST(
      v1Request("/classify", {
        method: "POST",
        session: sessionB,
        body: { title: "ماهی زنده" },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      categoryId: groceries.id,
      source: "fallback",
      matchedKey: null,
      confidence: null,
    });
  });

  it("returns an exact system-lexicon hit with confidence: null", async () => {
    const transport = await systemCategoryBySlug(db, sessionB.userId, "transport");
    const res = await classifyRoute.POST(
      v1Request("/classify", {
        method: "POST",
        session: sessionB,
        body: { title: "اسنپ" },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      categoryId: transport.id,
      source: "system",
      matchedKey: "اسنپ",
      confidence: null,
    });
  });

  it("returns a learned hit with confidence after the user saves such an expense", async () => {
    const cafe = await systemCategoryBySlug(db, sessionA.userId, "cafe-restaurant");
    await expensesRoute.POST(
      v1Request("/expenses", {
        method: "POST",
        session: sessionA,
        body: {
          amountToman: 65000,
          title: "کافه لاته",
          categoryId: cafe.id,
          entryMonthKey: CURRENT,
        },
      }),
    );

    const res = await classifyRoute.POST(
      v1Request("/classify", {
        method: "POST",
        session: sessionA,
        body: { title: "کافه لاته" },
      }),
    );
    expect(res.status).toBe(200);
    const suggestion = (await res.json()) as {
      categoryId: string;
      source: string;
      matchedKey: string | null;
      confidence: { purity: number; support: number } | null;
    };
    expect(suggestion.categoryId).toBe(cafe.id);
    expect(suggestion.source).toBe("learned");
    expect(suggestion.matchedKey).toBeTruthy();
    expect(suggestion.confidence).not.toBeNull();
    expect(suggestion.confidence!.purity).toBeGreaterThan(0);
    expect(suggestion.confidence!.support).toBeGreaterThan(0);
  });

  it("rejects an invalid title with 400", async () => {
    const res = await classifyRoute.POST(
      v1Request("/classify", {
        method: "POST",
        session: sessionA,
        body: { title: "   " },
      }),
    );
    await expectProblem(res, 400, "validation_failed");
  });
});
