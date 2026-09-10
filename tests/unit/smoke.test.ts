import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as schema from "@/db/schema";

describe("node project smoke", () => {
  it("zod parses a value", () => {
    const parser = z.object({ monthKey: z.string() });
    expect(parser.safeParse({ monthKey: "1405-06" }).success).toBe(true);
  });

  it("db schema exposes the better-auth tables and the domain tables", () => {
    expect(Object.keys(schema).sort()).toEqual(
      [
        "account",
        "categories",
        "events",
        "expenses",
        "learnedKeys",
        "recurringTemplates",
        "session",
        "user",
        "verification",
      ].sort(),
    );
  });
});
