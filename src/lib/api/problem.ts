import { DomainError, ValidationError } from "@/lib/services/errors";

// problem+json (RFC 9457) — the ONE error shape of the v1 API (ticket 25).
// `type` identifies the problem (a relative URI reference, one per code),
// `title` is its stable human summary, `status` mirrors the HTTP status,
// `detail` is a safe human explanation, and validation failures add the
// `errors` extension member (path/code/message; ticket 12's contract).

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

/** The registry of the ticket-12 statuses: 400 invalid field, 401 no
 * session, 404 unknown id, 409 the three category conflicts, 500 without an
 * internal leak. */
const PROBLEM_REGISTRY = {
  validation_failed: { status: 400, title: "Validation failed" },
  invalid_json: { status: 400, title: "Malformed JSON" },
  unauthorized: { status: 401, title: "Unauthorized" },
  not_found: { status: 404, title: "Not found" },
  category_in_use: { status: 409, title: "Category in use" },
  system_category_protected: {
    status: 409,
    title: "System category is protected",
  },
  duplicate_category_name: { status: 409, title: "Duplicate category name" },
  internal_error: { status: 500, title: "Internal server error" },
} as const;

export type ProblemCode = keyof typeof PROBLEM_REGISTRY;

const STATUS_FALLBACK_TITLES: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  404: "Not found",
  409: "Conflict",
  500: "Internal server error",
};

/** A thrown problem: handlers raise it, withRoute renders it. */
export class ApiProblem extends Error {
  readonly problem: ProblemBody;

  constructor(problem: ProblemBody) {
    super(problem.detail ?? problem.title);
    this.name = "ApiProblem";
    this.problem = problem;
  }

  get status(): number {
    return this.problem.status;
  }
}

/** Builds a problem from a registry code — the only constructor handlers
 * use directly. */
export function problem(
  code: ProblemCode,
  detail?: string,
  errors?: ProblemErrorEntry[],
): ApiProblem {
  const { status, title } = PROBLEM_REGISTRY[code];
  const body: ProblemBody = {
    type: `/problems/${code}`,
    title,
    status,
  };
  if (detail !== undefined) body.detail = detail;
  if (errors !== undefined) body.errors = errors;
  return new ApiProblem(body);
}

/** problem+json bytes — always the application/problem+json media type. */
export function problemResponse(body: ProblemBody): Response {
  return new Response(JSON.stringify(body), {
    status: body.status,
    headers: { "content-type": "application/problem+json" },
  });
}

/** Zod issues (or the service layer's unknown-shaped `issues`) → the
 * problem+json `errors` member. Issue paths join with `.`; an empty path is
 * the form-level entry. */
export function problemErrorsFromIssues(
  issues: unknown,
): ProblemErrorEntry[] {
  if (!Array.isArray(issues)) return [];
  return issues.map((issue) => {
    const record = issue as { path?: unknown; code?: unknown; message?: unknown };
    const path = Array.isArray(record.path)
      ? record.path.map(String).join(".")
      : "";
    return {
      path,
      code: typeof record.code === "string" ? record.code : "invalid",
      message:
        typeof record.message === "string" ? record.message : "invalid value",
    };
  });
}

/** The catch-all translation of anything a handler threw into a problem+json
 * response — the withRoute backstop. Domain errors carry their own
 * status/code; anything else is a 500 that logs internally and leaks
 * nothing (ticket 12). */
export function toProblemResponse(error: unknown): Response {
  if (error instanceof ApiProblem) {
    return problemResponse(error.problem);
  }

  if (error instanceof ValidationError) {
    return problemResponse(
      problem(
        "validation_failed",
        error.message,
        problemErrorsFromIssues(error.issues),
      ).problem,
    );
  }

  if (error instanceof DomainError) {
    if (error.code in PROBLEM_REGISTRY) {
      return problemResponse(
        problem(error.code as ProblemCode, error.message).problem,
      );
    }
    // An additive future code the registry doesn't know yet: keep its
    // status, derive the rest.
    return problemResponse({
      type: `/problems/${error.code}`,
      title: STATUS_FALLBACK_TITLES[error.status] ?? "Request failed",
      status: error.status,
      detail: error.message,
    });
  }

  console.error("[api] unhandled error:", error);
  return problemResponse(
    problem("internal_error", "an unexpected error occurred").problem,
  );
}
