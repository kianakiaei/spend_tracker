import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// The month semantics of the v1 API (ticket 25 over decisions 14/15 and
// tickets 23/24): the recurring-templates resource, the future-only
// forecast preview, «GET /api/v1/expenses?month= returns REAL expenses
// only», the summaries composite, and the mobile Bearer path. Each describe
// gets its own account so template-driven counts stay independent.

const dbUrl = `file:${join(tmpdir(), `api-v1-months-${randomUUID()}.db`)}`;
process.env.TURSO_DATABASE_URL = dbUrl;

const { db } = await import("@/db");
const { auth } = await import("@/lib/auth");
const { migrate } = await import("drizzle-orm/libsql/migrator");
await migrate(db, { migrationsFolder: "./drizzle" });

const expensesRoute = await import("@/app/api/v1/expenses/route");
const expenseIdRoute = await import("@/app/api/v1/expenses/[id]/route");
const templatesRoute = await import("@/app/api/v1/recurring-templates/route");
const templateIdRoute = await import("@/app/api/v1/recurring-templates/[id]/route");
const previewRoute = await import("@/app/api/v1/recurring-templates/preview/route");
const summariesRoute = await import("@/app/api/v1/summaries/route");
const categoriesRoute = await import("@/app/api/v1/categories/route");

const { systemCategoryBySlug, relativeMonthKeys } = await import(
  "../helpers/fixtures"
);
const { CURRENT, PREV, NEXT } = relativeMonthKeys();

const ORIGIN = "http://localhost:3000";

interface Session {
  userId: string;
  token: string;
  cookie: string;
}

/** A real account through better-auth's own mount — session token (Bearer)
 * plus the session cookie, both ready for the handlers. */
async function signUp(): Promise<Session> {
  const res = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "کاربر ماه‌ها",
        email: `months-${randomUUID()}@example.com`,
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
  expect(token).toBeTruthy();
  return { userId: body.user!.id!, token: token!, cookie };
}

function v1Request(
  path: string,
  init: {
    method?: string;
    session?: Session;
    useBearer?: boolean;
    body?: unknown;
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
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

async function expectProblem(res: Response, status: number, type?: string) {
  expect(res.status).toBe(status);
  expect(res.headers.get("content-type")).toBe("application/problem+json");
  const body = (await res.json()) as { type: string; title: string; status: number };
  expect(body.status).toBe(status);
  if (type) expect(body.type).toBe(`/problems/${type}`);
  return body;
}

interface TemplateDto {
  id: string;
  title: string;
  amountToman: number;
  categoryId: string;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  active: boolean;
}

/** Creates one template through the API; the installment category unless
 * overridden. */
async function createTemplate(
  session: Session,
  over: Partial<{
    amountToman: number;
    title: string;
    dayOfMonth: number;
    startDate: string;
  }> = {},
): Promise<TemplateDto> {
  const installment = await systemCategoryBySlug(
    db,
    session.userId,
    "installment",
  );
  const res = await templatesRoute.POST(
    v1Request("/recurring-templates", {
      method: "POST",
      session,
      body: {
        amountToman: 1_500_000,
        title: "قسط وام",
        categoryId: installment.id,
        dayOfMonth: 10,
        startDate: "2025-01-01",
        endDate: null,
        ...over,
      },
    }),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as TemplateDto;
}

// One account per describe: template-driven counts stay independent.
const session = await signUp(); // recurring-templates resource
const sessionP = await signUp(); // preview
const sessionE = await signUp(); // expenses across months
const sessionS = await signUp(); // summaries
const sessionBearer = await signUp(); // the Bearer path

afterAll(async () => {
  await db.$client.close();
});

describe("recurring-templates resource", () => {
  it("POST creates an active template; the save teaches (decision 06) inside the service", async () => {
    const template = await createTemplate(session, { title: "قبض برق" });
    expect(template.active).toBe(true);
    expect(template.dayOfMonth).toBe(10);
    expect(template.endDate).toBeNull();
  });

  it("GET lists the user's templates", async () => {
    const res = await templatesRoute.GET(
      v1Request("/recurring-templates", { session }),
    );
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{ id: string; userId: string }>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((row) => row.userId === session.userId)).toBe(true);
  });

  it("PATCH updates a template; DELETE removes it; an unknown id is 404", async () => {
    const template = await createTemplate(session, {
      title: "قسط خودرو",
      dayOfMonth: 5,
    });

    const patched = await templateIdRoute.PATCH(
      v1Request(`/recurring-templates/${template.id}`, {
        method: "PATCH",
        session,
        body: { dayOfMonth: 15, endDate: "2027-01-01" },
      }),
      idCtx(template.id),
    );
    expect(patched.status).toBe(200);
    const updated = (await patched.json()) as {
      dayOfMonth: number;
      endDate: string | null;
    };
    expect(updated.dayOfMonth).toBe(15);
    expect(updated.endDate).toBe("2027-01-01");

    const removed = await templateIdRoute.DELETE(
      v1Request(`/recurring-templates/${template.id}`, {
        method: "DELETE",
        session,
      }),
      idCtx(template.id),
    );
    expect(removed.status).toBe(204);

    const missing = await templateIdRoute.PATCH(
      v1Request(`/recurring-templates/${template.id}`, {
        method: "PATCH",
        session,
        body: { active: false },
      }),
      idCtx(template.id),
    );
    await expectProblem(missing, 404, "not_found");
  });

  it("rejects a template whose window ends before it starts with 400", async () => {
    const installment = await systemCategoryBySlug(
      db,
      session.userId,
      "installment",
    );
    const res = await templatesRoute.POST(
      v1Request("/recurring-templates", {
        method: "POST",
        session,
        body: {
          amountToman: 100,
          title: "پنجرهٔ وارونه",
          categoryId: installment.id,
          dayOfMonth: 1,
          startDate: "2026-05-01",
          endDate: "2026-04-01",
        },
      }),
    );
    await expectProblem(res, 400, "validation_failed");
  });
});

describe("GET preview?month= — future months only (decision 15)", () => {
  it("returns forecast rows {templateId,title,amountToman,categoryId,day} for the next month", async () => {
    await createTemplate(sessionP, { dayOfMonth: 20 });

    const res = await previewRoute.GET(
      v1Request(`/recurring-templates/preview?month=${encodeURIComponent(NEXT)}`, {
        session: sessionP,
      }),
    );
    expect(res.status).toBe(200);
    const rows = (await res.json()) as Array<{
      templateId: string;
      title: string;
      amountToman: number;
      categoryId: string;
      day: number;
    }>;
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.templateId).toBeTruthy();
    expect(row.title).toBe("قسط وام");
    expect(row.amountToman).toBe(1_500_000);
    expect(row.categoryId).toBe(
      (await systemCategoryBySlug(db, sessionP.userId, "installment")).id,
    );
    // day 20 fits every Jalali month — no clamp needed here.
    expect(row.day).toBe(20);
    // forecast rows are NOT expenses — no id/monthKey on the shape.
    expect("id" in row).toBe(false);
    expect("monthKey" in row).toBe(false);
  });

  it("renders 200 [] for the current and past months and 400 for a bad month", async () => {
    const current = await previewRoute.GET(
      v1Request(`/recurring-templates/preview?month=${encodeURIComponent(CURRENT)}`, {
        session: sessionP,
      }),
    );
    expect(current.status).toBe(200);
    await expect(await current.json()).toEqual([]);

    const past = await previewRoute.GET(
      v1Request(`/recurring-templates/preview?month=${encodeURIComponent(PREV)}`, {
        session: sessionP,
      }),
    );
    expect(past.status).toBe(200);
    await expect(await past.json()).toEqual([]);

    const junk = await previewRoute.GET(
      v1Request("/recurring-templates/preview?month=nope", { session: sessionP }),
    );
    await expectProblem(junk, 400, "validation_failed");
  });
});

describe("GET /expenses?month= across months", () => {
  it("a future month lists REAL expenses only — forecast rows never leak in (ticket 15)", async () => {
    await createTemplate(sessionE); // due in the future too — still no leak

    const ledger = await expensesRoute.GET(
      v1Request(`/expenses?month=${encodeURIComponent(NEXT)}`, { session: sessionE }),
    );
    expect(ledger.status).toBe(200);
    await expect(await ledger.json()).toEqual([]);
  });

  it("the current month's read carries the lazily generated expenses (decision 14)", async () => {
    const ledger = await expensesRoute.GET(
      v1Request(`/expenses?month=${encodeURIComponent(CURRENT)}`, { session: sessionE }),
    );
    expect(ledger.status).toBe(200);
    const rows = (await ledger.json()) as Array<{
      title: string;
      sourceRecurringId: string | null;
      monthKey: string;
    }>;
    const generated = rows.find((row) => row.sourceRecurringId !== null);
    expect(generated).toBeDefined();
    expect(generated!.monthKey).toBe(CURRENT);
    expect(generated!.title).toBe("قسط وام");
  });

  it("PATCH and DELETE on expenses stay month-agnostic (free edits, ticket 15)", async () => {
    const groceries = await systemCategoryBySlug(db, sessionE.userId, "groceries");
    const created = await expensesRoute.POST(
      v1Request("/expenses", {
        method: "POST",
        session: sessionE,
        body: {
          amountToman: 4000,
          title: "بی تاریخ",
          categoryId: groceries.id,
          occurredAt: null,
          entryMonthKey: PREV,
        },
      }),
    );
    const expense = (await created.json()) as { id: string; monthKey: string };
    expect(expense.monthKey).toBe(PREV);

    const patched = await expenseIdRoute.PATCH(
      v1Request(`/expenses/${expense.id}`, {
        method: "PATCH",
        session: sessionE,
        body: { occurredAt: "2026-01-10" },
      }),
      idCtx(expense.id),
    );
    expect(patched.status).toBe(200);
    // Giving an undated expense a date moves it to that date's month
    // (2026-01-10 = Dey 1404).
    expect(((await patched.json()) as { monthKey: string }).monthKey).toBe(
      "1404-10",
    );

    const removed = await expenseIdRoute.DELETE(
      v1Request(`/expenses/${expense.id}`, { method: "DELETE", session: sessionE }),
      idCtx(expense.id),
    );
    expect(removed.status).toBe(204);
  });
});

describe("GET /summaries?month= — the dashboard composite (tickets 12/15/24)", () => {
  it("the current month sums recorded + generated expenses without a forecast field", async () => {
    await createTemplate(sessionS); // 1_500_000, installment, due now
    const groceries = await systemCategoryBySlug(db, sessionS.userId, "groceries");
    await expensesRoute.POST(
      v1Request("/expenses", {
        method: "POST",
        session: sessionS,
        body: {
          amountToman: 30000,
          title: "سبزی",
          categoryId: groceries.id,
          entryMonthKey: CURRENT,
        },
      }),
    );

    const res = await summariesRoute.GET(
      v1Request(`/summaries?month=${encodeURIComponent(CURRENT)}`, { session: sessionS }),
    );
    expect(res.status).toBe(200);
    const summary = (await res.json()) as {
      monthKey: string;
      totalToman: number;
      byCategory: Array<{
        categoryId: string;
        name: string;
        totalToman: number;
        count: number;
      }>;
      forecastToman?: number;
    };
    expect(summary.monthKey).toBe(CURRENT);
    expect("forecastToman" in summary).toBe(false);
    expect(summary.totalToman).toBe(1_530_000);
    const groceryTile = summary.byCategory.find(
      (entry) => entry.categoryId === groceries.id,
    );
    expect(groceryTile).toBeDefined();
    expect(groceryTile!.totalToman).toBe(30000);
    expect(groceryTile!.count).toBe(1);
    const installmentTile = summary.byCategory.find(
      (entry) => entry.name === "قسط",
    );
    expect(installmentTile).toBeDefined();
    expect(installmentTile!.totalToman).toBe(1_500_000);
    // The generated row IS an expense — it counts like any other.
    expect(installmentTile!.count).toBe(1);
  });

  it("a future month composites recorded + forecast and carries forecastToman", async () => {
    const res = await summariesRoute.GET(
      v1Request(`/summaries?month=${encodeURIComponent(NEXT)}`, { session: sessionS }),
    );
    expect(res.status).toBe(200);
    const summary = (await res.json()) as {
      monthKey: string;
      totalToman: number;
      forecastToman?: number;
      byCategory: Array<{ categoryId: string; name: string; count: number; totalToman: number }>;
    };
    expect(summary.monthKey).toBe(NEXT);
    expect(summary.forecastToman).toBe(1_500_000);
    expect(summary.totalToman).toBe(1_500_000);
    const installmentTile = summary.byCategory.find(
      (entry) => entry.name === "قسط",
    );
    expect(installmentTile).toBeDefined();
    expect(installmentTile!.totalToman).toBe(1_500_000);
    expect(installmentTile!.count).toBe(0); // forecast rows contribute totals only
  });
});

describe("the mobile Bearer path on v1 (ticket 08)", () => {
  it("reads accept Authorization: Bearer transparently", async () => {
    await createTemplate(sessionBearer); // so the preview has a row

    const list = await categoriesRoute.GET(
      v1Request("/categories", { session: sessionBearer, useBearer: true }),
    );
    expect(list.status).toBe(200);
    const rows = (await list.json()) as Array<{ kind: string }>;
    expect(rows).toHaveLength(6);

    const preview = await previewRoute.GET(
      v1Request(`/recurring-templates/preview?month=${encodeURIComponent(NEXT)}`, {
        session: sessionBearer,
        useBearer: true,
      }),
    );
    expect(preview.status).toBe(200);
    expect(((await preview.json()) as unknown[]).length).toBe(1);
  });
});
