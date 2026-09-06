import { prettifyError, type ZodType } from "zod";
import { ValidationError } from "./errors";

// The one input gate every service write goes through (ticket 22): parse a
// Zod-composed input schema or throw the typed 400. The message is zod's
// prettified output (readable); `issues` stays the structured array so the
// ticket-25 handler can build problem+json's errors (path/code/message)
// without re-parsing.

export function parseOrThrow<T>(schema: ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      `invalid ${label}\n${prettifyError(result.error)}`,
      result.error.issues,
    );
  }
  return result.data;
}
