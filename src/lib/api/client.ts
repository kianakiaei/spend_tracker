import type { ZodType } from "zod";
import { z } from "zod";
import {
  categoryResponseSchema,
  classifyResponseSchema,
  expenseResponseSchema,
  forecastRowResponseSchema,
  monthSummaryResponseSchema,
  moveExpensesResponseSchema,
  recurringTemplateResponseSchema,
  type ClassifyRequest,
  type CreateCategoryRequest,
  type CreateExpenseRequest,
  type CreateTemplateRequest,
  type MoveExpensesRequest,
  type UpdateCategoryRequest,
  type UpdateExpenseRequest,
  type UpdateTemplateRequest,
} from "@/lib/schemas";

// The typed fetch wrapper of the v1 API (ticket 25): the ONE client path
// for web and mobile (ticket 12). Requests are typed with the shared
// z.infer DTOs; every success body is runtime-validated with the shared
// response schemas, and every failure is parsed as problem+json into
// ApiError. The web client uses the `api` singleton (same-origin cookies);
// a mobile build calls createV1Client with its base URL and a Bearer header
// supplier (ticket 08) — OpenAPI is deliberately not built yet (ticket 10).

export interface ProblemErrorEntry {
  path: string;
  code: string;
  message: string;
}

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: ProblemErrorEntry[];
}

/** Thrown for every non-2xx response; `.problem` is the parsed problem+json
 * body, `.errors` the validation entries. Network faults surface as the
 * platform's TypeError. A success body that fails its schema re-raises the
 * ZodError — that is a client/server contract bug, not user input. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemBody;

  constructor(problem: ProblemBody) {
    super(
      `${problem.status} ${problem.title}${problem.detail ? ` — ${problem.detail}` : ""}`,
    );
    this.name = "ApiError";
    this.status = problem.status;
    this.problem = problem;
  }

  get errors(): ProblemErrorEntry[] {
    return this.problem.errors ?? [];
  }
}

function isProblemBody(value: unknown): value is ProblemBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "title" in value &&
    "status" in value
  );
}

export interface V1ClientOptions {
  /** Base of the v1 API; the web default is same-origin "/api/v1". */
  baseUrl?: string;
  /** Per-call headers — the mobile Bearer path plugs in here (ticket 08). */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Test seam; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

export function createV1Client(options: V1ClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "/api/v1";
  const doFetch = options.fetchFn ?? fetch;

  async function request(
    method: string,
    path: string,
    init: { body?: unknown; query?: Record<string, string> },
  ): Promise<Response> {
    const extraHeaders =
      options.headers !== undefined ? await options.headers() : {};
    const headers: Record<string, string> = { ...extraHeaders };

    let body: string | undefined;
    if (init.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(init.body);
    }
    const query = init.query
      ? `?${new URLSearchParams(init.query).toString()}`
      : "";

    return doFetch(`${baseUrl}${path}${query}`, { method, headers, body });
  }

  async function errorFrom(response: Response): Promise<ApiError> {
    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      raw = undefined;
    }
    if (isProblemBody(raw)) return new ApiError(raw);
    // Not problem+json (a proxy error page, an HTML crash) — wrap so callers
    // still see one error shape.
    return new ApiError({
      type: "/problems/unknown",
      title: response.statusText || "Request failed",
      status: response.status,
    });
  }

  /** 2xx whose body is validated with a shared response schema. */
  async function data<Out>(
    method: string,
    path: string,
    out: ZodType<Out>,
    init: { body?: unknown; query?: Record<string, string> } = {},
  ): Promise<Out> {
    const response = await request(method, path, init);
    if (!response.ok) throw await errorFrom(response);
    return out.parse(await response.json());
  }

  /** 2xx with no body to read (204 deletes). */
  async function send(
    method: string,
    path: string,
    init: { body?: unknown } = {},
  ): Promise<void> {
    const response = await request(method, path, init);
    if (!response.ok) throw await errorFrom(response);
  }

  const idPath = (id: string) => `/${encodeURIComponent(id)}`;

  return {
    expenses: {
      create: (input: CreateExpenseRequest) =>
        data("POST", "/expenses", expenseResponseSchema, { body: input }),
      listByMonth: (month: string) =>
        data("GET", "/expenses", z.array(expenseResponseSchema), {
          query: { month },
        }),
      get: (id: string) =>
        data("GET", `/expenses${idPath(id)}`, expenseResponseSchema),
      update: (id: string, patch: UpdateExpenseRequest) =>
        data("PATCH", `/expenses${idPath(id)}`, expenseResponseSchema, {
          body: patch,
        }),
      remove: (id: string) => send("DELETE", `/expenses${idPath(id)}`),
    },
    categories: {
      list: () =>
        data("GET", "/categories", z.array(categoryResponseSchema)),
      create: (input: CreateCategoryRequest) =>
        data("POST", "/categories", categoryResponseSchema, { body: input }),
      update: (id: string, patch: UpdateCategoryRequest) =>
        data("PATCH", `/categories${idPath(id)}`, categoryResponseSchema, {
          body: patch,
        }),
      remove: (id: string) => send("DELETE", `/categories${idPath(id)}`),
      moveExpenses: (id: string, input: MoveExpensesRequest) =>
        data(
          "POST",
          `/categories${idPath(id)}/move-expenses`,
          moveExpensesResponseSchema,
          { body: input },
        ),
    },
    recurringTemplates: {
      list: () =>
        data("GET", "/recurring-templates", z.array(recurringTemplateResponseSchema)),
      create: (input: CreateTemplateRequest) =>
        data("POST", "/recurring-templates", recurringTemplateResponseSchema, {
          body: input,
        }),
      update: (id: string, patch: UpdateTemplateRequest) =>
        data(
          "PATCH",
          `/recurring-templates${idPath(id)}`,
          recurringTemplateResponseSchema,
          { body: patch },
        ),
      remove: (id: string) =>
        send("DELETE", `/recurring-templates${idPath(id)}`),
      preview: (month: string) =>
        data(
          "GET",
          "/recurring-templates/preview",
          z.array(forecastRowResponseSchema),
          { query: { month } },
        ),
    },
    summaries: {
      getByMonth: (month: string) =>
        data("GET", "/summaries", monthSummaryResponseSchema, {
          query: { month },
        }),
    },
    classify: (input: ClassifyRequest) =>
      data("POST", "/classify", classifyResponseSchema, { body: input }),
  };
}

/** The web client: same-origin, cookie-authenticated. */
export const api = createV1Client();

export type V1Client = ReturnType<typeof createV1Client>;
