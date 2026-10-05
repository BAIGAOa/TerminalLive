import { describe, it, expect } from "vitest";
import {
  ATTRIBUTE_META,
  getAttrMeta,
  PlayerConfigCategory,
  validateValue,
} from "../../world/playerConfig.js";

describe("ATTRIBUTE_META", () => {
  it("covers every category", () => {
    for (const cat of Object.values(PlayerConfigCategory)) {
      expect(ATTRIBUTE_META[cat]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("finds attributes across categories and rejects unknown keys", () => {
    expect(getAttrMeta("health")?.max).toBe(100);
    expect(getAttrMeta("money")?.min).toBe(0);
    expect(getAttrMeta("nope")).toBeUndefined();
  });
});

describe("validateValue", () => {
  it("trims non-empty strings", () => {
    expect(validateValue("playerName", "  Bob  ")).toEqual({
      valid: true,
      value: "Bob",
    });
    expect(validateValue("playerName", "   ")).toEqual({
      valid: false,
      errorKey: "playerConfig.error.empty",
    });
  });

  it("rejects non-numeric and empty number input", () => {
    expect(validateValue("age", "abc")).toEqual({
      valid: false,
      errorKey: "playerConfig.error.number",
    });
    expect(validateValue("age", "")).toEqual({
      valid: false,
      errorKey: "playerConfig.error.number",
    });
  });

  it("enforces min and max with the bound in params", () => {
    expect(validateValue("age", "-1")).toEqual({
      valid: false,
      errorKey: "playerConfig.error.min",
      params: { n: 0 },
    });
    expect(validateValue("age", "200")).toEqual({
      valid: false,
      errorKey: "playerConfig.error.max",
      params: { n: 150 },
    });
    expect(validateValue("height", "0.4")).toEqual({
      valid: false,
      errorKey: "playerConfig.error.min",
      params: { n: 0.5 },
    });
  });

  it("parses valid numbers and allows a min-only attribute (money)", () => {
    expect(validateValue("age", "42")).toEqual({ valid: true, value: 42 });
    expect(validateValue("height", "2.5")).toEqual({ valid: true, value: 2.5 });
    expect(validateValue("money", "-5")).toEqual({
      valid: false,
      errorKey: "playerConfig.error.min",
      params: { n: 0 },
    });
    expect(validateValue("money", "12")).toEqual({ valid: true, value: 12 });
  });

  it("fails closed for an unknown key", () => {
    expect(validateValue("unknownKey", "5")).toEqual({
      valid: false,
      errorKey: "playerConfig.error.number",
    });
  });
});
