import { describe, it, expect } from "vitest";
import {
  validateEventFile,
  validateEventJson,
} from "../../core/mod/eventValidation.js";

describe("validateEventJson", () => {
  it("accepts a well-formed event", () => {
    expect(
      validateEventJson({ type: "T", id: "e1", nameKey: "events.e1", weight: 10 })
        .ok,
    ).toBe(true);
  });

  it("reports missing required fields", () => {
    const r = validateEventJson({ nameKey: "x" });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toContain("type");
  });

  it("allows a zero weight (loader default tolerance)", () => {
    expect(validateEventJson({ type: "T", id: "e", weight: 0 }).ok).toBe(true);
  });
});

describe("validateEventFile", () => {
  it("validates every entry and indexes errors", () => {
    const r = validateEventFile([
      { type: "T", id: "a", nameKey: "k" },
      { id: "b" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith("[1]"))).toBe(true);
  });

  it("accepts a single object or an all-valid array", () => {
    expect(validateEventFile({ type: "T", id: "a", nameKey: "k" }).ok).toBe(true);
    expect(
      validateEventFile([{ type: "T", id: "a", nameKey: "k" }]).ok,
    ).toBe(true);
  });
});
