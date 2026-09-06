import { toProblemResponse } from "./problem";

// The v1 route-handler wrapper (ticket 25): runs the thin
// parse → service → respond body and renders every throw as problem+json
// (ticket 12's contract). Handlers are ordinary functions of
// (Request, ctx) — integration tests invoke them directly.

/** JSON success response; `204` renders body-less. */
export function jsonResponse(data: unknown, status: 200 | 201 = 200): Response {
  return Response.json(data, { status });
}

export function emptyResponse(): Response {
  return new Response(null, { status: 204 });
}

/** The context of every /api/v1/[id] route — Next 16 hands `params` as a
 * promise. */
export type IdCtx = { params: Promise<{ id: string }> };

export function withRoute(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response>;
export function withRoute<Ctx>(
  handler: (request: Request, ctx: Ctx) => Promise<Response>,
): (request: Request, ctx: Ctx) => Promise<Response>;
export function withRoute<Ctx>(
  handler: (request: Request, ctx?: Ctx) => Promise<Response>,
): (request: Request, ctx?: Ctx) => Promise<Response> {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (error) {
      return toProblemResponse(error);
    }
  };
}
