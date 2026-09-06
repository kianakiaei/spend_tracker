import type { ZodType } from "zod";
import { problem, problemErrorsFromIssues } from "./problem";

// The thin request gates of the v1 handlers (ticket 25): parse a body or a
// query with a shared DTO schema or throw the problem+json 400. Handlers
// stay parse → service → respond; nothing else validates here.

function parseOrProblem<T>(schema: ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw problem(
      "validation_failed",
      `invalid ${label}`,
      problemErrorsFromIssues(result.error.issues),
    );
  }
  return result.data;
}

/** The JSON body of a mutating request. A non-JSON body is its own 400
 * (`invalid_json` — it never reaches the schema). */
export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw problem("invalid_json", "request body is not valid JSON");
  }
  return parseOrProblem(schema, raw, "request body");
}

/** The query string of a read, as an object (repeated keys take the last
 * value — the API's queries are all single-key). */
export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  return parseOrProblem(schema, params, "query string");
}
