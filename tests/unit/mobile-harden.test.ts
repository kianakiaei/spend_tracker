import { describe, expect, it } from "vitest";

// Expo-mobile ticket 09 (harden + verify): the final parity pass — one
// consistent server-error shape with field-level messages, a unified
// mutation fan-out so no surface goes stale, Persian digits on ledger
// quantities, and the sheet contract in one place. Pure core only: the Expo
// screens are thin wrappers around these helpers.

import {
  affectedScopesForExpenseSave,
} from "../../apps/mobile/src/queries";
import { affectedScopesForTemplateMutation } from "../../apps/mobile/src/template-queries";
import { affectedScopesForCategoryMutation } from "../../apps/mobile/src/category-queries";
import { affectedScopesForEventMutation } from "../../apps/mobile/src/event-queries";
import { formatLedgerQuantity } from "../../apps/mobile/src/dashboard";
import {
  fieldErrorsFor,
  fieldMessageFor,
  saveErrorMessage,
} from "../../apps/mobile/src/server-errors";

function apiError(errors: { path: string; code: string; message: string }[]) {
  return {
    name: "ApiError",
    status: 400,
    problem: { type: "/problems/validation", title: "نامعتبر", status: 400, errors },
  };
}

describe("ticket 09: unified mutation fan-out", () => {
  it("expense saves also refresh templates (forecast tiles read previews)", () => {
    const scopes = affectedScopesForExpenseSave({
      previousOccurredAt: null,
      nextOccurredAt: "2026-09-23",
    });
    expect(scopes.lists).toEqual(
      expect.arrayContaining(["categories", "events", "search", "insights", "templates"]),
    );
  });

  it("template mutations also refresh search + events", () => {
    expect(affectedScopesForTemplateMutation().lists).toEqual(
      expect.arrayContaining([
        "templates",
        "dashboard",
        "categories",
        "insights",
        "search",
        "events",
      ]),
    );
  });

  it("category mutations also refresh search + events", () => {
    expect(affectedScopesForCategoryMutation().lists).toEqual(
      expect.arrayContaining([
        "categories",
        "dashboard",
        "templates",
        "insights",
        "search",
        "events",
      ]),
    );
  });

  it("event mutations also refresh categories + templates", () => {
    expect(affectedScopesForEventMutation().lists).toEqual(
      expect.arrayContaining([
        "events",
        "dashboard",
        "search",
        "insights",
        "categories",
        "templates",
      ]),
    );
  });
});

describe("ticket 09: one server-error shape with field messages", () => {
  const FALLBACK = "ذخیره نشد؛ دوباره تلاش کنید.";

  it("reads problem+json field entries off an ApiError", () => {
    const err = apiError([
      { path: "title", code: "required", message: "عنوان لازم است." },
      { path: "amountToman", code: "min", message: "مبلغ باید مثبت باشد." },
    ]);
    expect(fieldErrorsFor(err)).toHaveLength(2);
    expect(fieldMessageFor(err, "title")).toBe("عنوان لازم است.");
    expect(saveErrorMessage(err, FALLBACK)).toBe("عنوان لازم است.");
  });

  it("falls back for generic failures (network, unknown shape)", () => {
    expect(fieldErrorsFor(new Error("boom"))).toEqual([]);
    expect(fieldMessageFor(new Error("boom"), "title")).toBeNull();
    expect(saveErrorMessage(new Error("boom"), FALLBACK)).toBe(FALLBACK);
    expect(saveErrorMessage(apiError([]), FALLBACK)).toBe(FALLBACK);
  });
});

describe("ticket 09: Persian digits on ledger quantities", () => {
  it("renders quantities (incl. 0.5 kilo) in Persian digits", () => {
    expect(formatLedgerQuantity(2)).toBe("۲");
    expect(formatLedgerQuantity(0.5)).toBe("۰.۵");
  });
});
