import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as schema from "@/db/schema";

describe("node project smoke", () => {
  it("zod parses a value", () => {
    const parser = z.object({ monthKey: z.string() });
    expect(parser.safeParse({ monthKey: "1405-06" }).success).toBe(true);
  });

  it("db schema exposes the four better-auth tables", () => {
    expect(Object.keys(schema).sort()).toEqual(
      ["account", "session", "user", "verification"].sort(),
    );
  });
});
