import { describe, expect, it, vi } from "vitest";
import {
  ApiProblem,
  problem,
  problemResponse,
  toProblemResponse,
} from "@/lib/api/problem";
import {
  CategoryInUseError,
  DomainError,
  NotFoundError,
  ValidationError,
} from "@/lib/services/errors";

// Unit pins of the problem+json contract (ticket 25) that the integration
// files only see incidentally: the registry response, the DomainError
// mapping, and the 500 catch-all that leaks NOTHING internal (ticket 12).

describe("problem+json contract", () => {
  it("renders a registry problem with the problem+json media type and members", async () => {
    const res = problemResponse(
      problem("unauthorized", "sign in to use the v1 API").problem,
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    const body = (await res.json()) as {
      type: string;
      title: string;
      status: number;
      detail?: string;
    };
    expect(body).toEqual({
      type: "/problems/unauthorized",
      title: "Unauthorized",
      status: 401,
      detail: "sign in to use the v1 API",
    });
  });

  it("maps service ValidationErrors to 400 with errors[] (path/code/message)", async () => {
    const error = new ValidationError("invalid expense input", [
      { path: ["amountToman"], code: "too_small", message: "too small" },
    ]);
    const res = toProblemResponse(error);
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      type: string;
      errors: Array<{ path: string; code: string; message: string }>;
    };
    expect(body.type).toBe("/problems/validation_failed");
    expect(body.errors).toEqual([
      { path: "amountToman", code: "too_small", message: "too small" },
    ]);
  });

  it("maps the other DomainErrors to their status/code with a safe detail", async () => {
    const res = toProblemResponse(new CategoryInUseError('"هدیه" still has expenses'));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { type: string; detail: string };
    expect(body.type).toBe("/problems/category_in_use");
    expect(body.detail).toBe('"هدیه" still has expenses');

    expect(toProblemResponse(new NotFoundError()).status).toBe(404);
  });

  it("keeps an additive DomainError code the registry does not know yet", async () => {
    class FutureConflict extends DomainError {
      constructor() {
        super(409, "future_conflict", "a documented future conflict");
      }
    }
    const res = toProblemResponse(new FutureConflict());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { type: string; title: string };
    expect(body.type).toBe("/problems/future_conflict");
    expect(body.title).toBe("Conflict");
  });

  it("the 500 catch-all leaks nothing internal (ticket 12)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = toProblemResponse(new Error("secret internal message: db@host"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { type: string; detail?: string };
    expect(body.type).toBe("/problems/internal_error");
    expect(body.detail).toBe("an unexpected error occurred");
    expect(JSON.stringify(body)).not.toContain("secret internal message");
    expect(spy).toHaveBeenCalledWith("[api] unhandled error:", expect.any(Error));
    spy.mockRestore();
  });

  it("ApiProblem renders itself and reports its status", () => {
    const problem401 = problem("unauthorized");
    expect(problem401).toBeInstanceOf(ApiProblem);
    expect(problem401.status).toBe(401);
    expect(problem401.message).toBe("Unauthorized");
  });

  it("maps non-Zod issue shapes defensively to form-level errors", async () => {
    const error = new ValidationError("odd issues", [
      "not-an-issue-object",
      { path: "flat", message: "no code" },
    ]);
    const res = toProblemResponse(error);
    const body = (await res.json()) as {
      errors: Array<{ path: string; code: string; message: string }>;
    };
    expect(body.errors).toEqual([
      { path: "", code: "invalid", message: "invalid value" },
      { path: "flat", code: "invalid", message: "no code" },
    ]);
  });
});
