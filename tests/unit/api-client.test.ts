import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError, createV1Client } from "@/lib/api/client";

// Unit behavior of the typed fetch wrapper (ticket 25): typed inputs, one
// error shape (ApiError over problem+json), runtime validation of success
// bodies with the shared response schemas, and the 204 path. The HTTP
// contracts themselves are proven against the real handlers in
// tests/integration/api-v1-*.test.ts — here the fetch function is injected.

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function problemResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

function clientWith(
  respond: (url: string, init: RequestInit) => Response | Promise<Response>,
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createV1Client({
    fetchFn: async (input, init) => {
      calls.push({ url: String(input), init: init! });
      return respond(String(input), init!);
    },
  });
  return { client, calls };
}

describe("createV1Client — requests", () => {
  // A schema-valid summary — the smallest happy body the shared schemas
  // accept (the client validates every success body against them).
  const summary = { monthKey: "1404-10", totalToman: 1, byCategory: [] };
  const classifyAnswer = {
    categoryId: "0198c0de-0000-7000-8000-000000000000",
    source: "fallback",
    matchedKey: null,
    confidence: null,
  };

  it("sends a typed GET with its query and validates the success body", async () => {
    const { client, calls } = clientWith(() => jsonResponse(summary));
    const summaryDto = await client.summaries.getByMonth("1404-10");
    expect(summaryDto).toEqual(summary);
    expect(calls[0]!.url).toBe("/api/v1/summaries?month=1404-10");
    expect(calls[0]!.init.method).toBe("GET");
  });

  it("sends a typed POST body with the JSON content type", async () => {
    const { client, calls } = clientWith(() => jsonResponse(classifyAnswer));
    const suggestion = await client.classify({ title: "نان" });
    expect(suggestion).toEqual(classifyAnswer);
    expect(calls[0]!.url).toBe("/api/v1/classify");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(calls[0]!.init.body).toBe(JSON.stringify({ title: "نان" }));
  });

  it("encodes path ids and passes the per-call headers (the mobile Bearer path)", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const bearer = createV1Client({
      headers: () => ({ authorization: "Bearer token-1" }),
      fetchFn: async (input, init) => {
        calls.push({ url: String(input), init: init! });
        return new Response(null, { status: 204 });
      },
    });
    await bearer.expenses.remove("id with space");
    expect(calls[0]!.url).toBe("/api/v1/expenses/id%20with%20space");
    expect(calls[0]!.init.headers).toMatchObject({
      authorization: "Bearer token-1",
    });
  });

  it("returns void on a 204 delete without parsing a body", async () => {
    const { client } = clientWith(() => new Response(null, { status: 204 }));
    await expect(client.expenses.remove("id-1")).resolves.toBeUndefined();
  });
});

describe("createV1Client — errors", () => {
  it("raises ApiError with the parsed problem+json body", async () => {
    const { client } = clientWith(() =>
      problemResponse(
        {
          type: "/problems/validation_failed",
          title: "Validation failed",
          status: 400,
          detail: "invalid request body",
          errors: [
            { path: "amountToman", code: "too_small", message: "too small" },
          ],
        },
        400,
      ),
    );
    const error = await client.expenses
      .create({} as never)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.problem.type).toBe("/problems/validation_failed");
    expect(apiError.errors).toEqual([
      { path: "amountToman", code: "too_small", message: "too small" },
    ]);
  });

  it("wraps a non-problem error page so callers still see one error shape", async () => {
    const { client } = clientWith(
      () => new Response("<html>crash</html>", { status: 502 }),
    );
    const error = await client.categories.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(502);
    expect(apiError.problem.type).toBe("/problems/unknown");
  });

  it("surfaces network faults as the platform TypeError", async () => {
    const client = createV1Client({
      fetchFn: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(client.categories.list()).rejects.toThrow(TypeError);
  });

  it("re-raises a ZodError when a success body violates the shared schema", async () => {
    const { client } = clientWith(() => jsonResponse({ id: "not-a-uuid" }));
    await expect(client.categories.list()).rejects.toThrow(z.ZodError);
  });
});
