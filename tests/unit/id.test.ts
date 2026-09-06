import { describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { uuidv7Schema } from "@/lib/schemas";

describe("newId (UUIDv7, app-generated)", () => {
  it("generates a valid UUIDv7 string", () => {
    expect(uuidv7Schema.safeParse(newId()).success).toBe(true);
  });

  it("generates distinct ids", () => {
    const seen = new Set(Array.from({ length: 100 }, () => newId()));
    expect(seen.size).toBe(100);
  });

  it("carries version 7 and RFC 9562 variant bits", () => {
    const id = newId();
    expect(id[14]).toBe("7");
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });

  it("encodes the current unix time in ms in the first 48 bits", () => {
    const before = Date.now();
    const id = newId();
    const after = Date.now();
    const tsMs = Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
    expect(tsMs).toBeGreaterThanOrEqual(before);
    expect(tsMs).toBeLessThanOrEqual(after);
  });
});
