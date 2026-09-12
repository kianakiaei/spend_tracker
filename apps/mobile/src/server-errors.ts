// Server-error shape (expo-mobile ticket 09, spec: "one consistent error
// shape for API failures with field-level validation messages where the
// server provides them").
//
// Pure: the frozen API fails as problem+json (see
// packages/shared/src/api/problem-body.ts) surfaced as ApiError with
// `.problem.errors[]` ({path, message}). Screens keep their Persian fallback
// voice and layer the first field message on top of it. Unknown shapes
// (network TypeErrors, non-JSON proxies wrapped as /problems/unknown) fall
// back.

export interface ServerFieldError {
  path: string;
  message: string;
}

/** problem+json field entries off any thrown value — [] when there are none. */
export function fieldErrorsFor(error: unknown): ServerFieldError[] {
  if (typeof error !== "object" || error === null) return [];
  const problem =
    "problem" in error && typeof error.problem === "object" && error.problem !== null
      ? (error.problem as { errors?: unknown })
      : null;
  if (!problem || !Array.isArray(problem.errors)) return [];
  const out: ServerFieldError[] = [];
  for (const entry of problem.errors) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      "path" in entry &&
      "message" in entry &&
      typeof (entry as { path: unknown }).path === "string" &&
      typeof (entry as { message: unknown }).message === "string"
    ) {
      out.push({
        path: (entry as { path: string }).path,
        message: (entry as { message: string }).message,
      });
    }
  }
  return out;
}

/** The message for one field path, or null when the server said nothing
 * about it (the screen keeps its own client-side hint). */
export function fieldMessageFor(error: unknown, path: string): string | null {
  return fieldErrorsFor(error).find((e) => e.path === path)?.message ?? null;
}

/** What the sheet/screen shows: the first server field message when the
 * server provided one, else the screen's Persian fallback. */
export function saveErrorMessage(error: unknown, fallback: string): string {
  return fieldErrorsFor(error)[0]?.message ?? fallback;
}
