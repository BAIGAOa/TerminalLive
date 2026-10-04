import { describe, it, expect } from "vitest";
import {
  canLoadContent,
  hasCapability,
  LEGACY_CAPABILITIES,
  normalizeCapabilities,
} from "../../core/mod/capabilities.js";

describe("mod capabilities", () => {
  it("falls back to legacy content capabilities when undeclared", () => {
    expect(normalizeCapabilities(undefined)).toEqual(LEGACY_CAPABILITIES);
    expect(hasCapability({}, "events")).toBe(true);
    expect(hasCapability({}, "world")).toBe(false);
    expect(hasCapability({}, "ui")).toBe(false);
  });

  it("drops unknown capabilities", () => {
    expect(normalizeCapabilities(["events", "hax", "ui"])).toEqual([
      "events",
      "ui",
    ]);
  });

  it("grants exactly what is declared", () => {
    const m = { capabilities: ["events", "world"] };
    expect(hasCapability(m, "world")).toBe(true);
    expect(hasCapability(m, "items")).toBe(false);
    expect(canLoadContent(m, "events")).toBe(true);
    expect(canLoadContent(m, "items")).toBe(false);
  });

  it("treats an explicit empty list as no powers", () => {
    const m = { capabilities: [] as string[] };
    expect(hasCapability(m, "events")).toBe(false);
  });
});
