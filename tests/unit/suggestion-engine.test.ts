import { describe, expect, it } from "vitest";
import { createSuggestionEngine } from "@/lib/categorization/suggestion-engine";

// Ticket 27 — the client-side composition of the ticket-21 engine for the
// live form suggestion (ticket 06: lexicon + learned keys + categories in
// memory, microsecond answers). The ladder itself is unit-tested in
// categorization.test.ts; here only the composition matters: a null rung is
// answered by the precomputed fallback, never left null.

const GROCERIES = "01900000-0000-7000-8000-000000000001";
const TRANSPORT = "01900000-0000-7000-8000-000000000002";
const INSTALLMENTS = "01900000-0000-7000-8000-000000000003";

function build(overrides?: {
  learnedKeys?: Array<{ key: string; categoryId: string; count: number }>;
  fallbackCategoryId?: string;
}) {
  return createSuggestionEngine({
    categories: [
      { id: GROCERIES, name: "خوراکی", slug: "groceries" },
      { id: TRANSPORT, name: "حمل‌ونقل", slug: "transport" },
      { id: INSTALLMENTS, name: "قسط", slug: "installment" },
    ],
    learnedKeys: overrides?.learnedKeys ?? [],
    fallbackCategoryId: overrides?.fallbackCategoryId ?? GROCERIES,
  });
}

describe("createSuggestionEngine (client composition, ticket 27)", () => {
  it("answers from the system lexicon ladder", () => {
    expect(build().classify("تاکسی فرودگاه")).toEqual({
      categoryId: TRANSPORT,
      source: "system",
    });
  });

  it("answers from learned counters above the lexicon", () => {
    const engine = build({
      learnedKeys: [{ key: "نان", categoryId: INSTALLMENTS, count: 3 }],
    });
    expect(engine.classify("خرید نان")).toEqual({
      categoryId: INSTALLMENTS,
      source: "learned",
    });
  });

  it("never returns null — the fallback category answers a no-guess title", () => {
    expect(build().classify("چیز بی‌ربط")).toEqual({
      categoryId: GROCERIES,
      source: "fallback",
    });
  });

  it("the fallback also answers the empty title the sheet opens with", () => {
    expect(build().classify("")).toEqual({
      categoryId: GROCERIES,
      source: "fallback",
    });
  });
});
