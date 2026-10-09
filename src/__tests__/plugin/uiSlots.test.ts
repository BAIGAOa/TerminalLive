import { describe, it, expect, vi } from "vitest";
import { SCREEN_SLOTS, UiSlotRegistry } from "../../core/plugin/ui.js";

const A = () => null;
const B = () => null;
const C = () => null;

describe("UI slots", () => {
  it("renders nothing of its own until a plugin provides one", () => {
    const reg = new UiSlotRegistry();
    expect(reg.resolve(SCREEN_SLOTS.mainMenu)).toBeUndefined();
  });

  it("lets a plugin take over a screen", () => {
    const reg = new UiSlotRegistry();
    reg.provide(SCREEN_SLOTS.mainMenu, A, "builtin", 0);
    reg.provide(SCREEN_SLOTS.mainMenu, B, "my-mod", 0);
    // Same priority → the newest wins, so a mod loaded after the game wins.
    expect(reg.resolve(SCREEN_SLOTS.mainMenu)).toBe(B);
    expect(reg.best(SCREEN_SLOTS.mainMenu)?.owner).toBe("my-mod");
  });

  it("respects an explicit priority over load order", () => {
    const reg = new UiSlotRegistry();
    reg.provide("panel", A, "weak", 0);
    reg.provide("panel", B, "strong", 5);
    reg.provide("panel", C, "later-but-weak", 0);
    expect(reg.resolve("panel")).toBe(B);
    expect(reg.list("panel").map((r) => r.owner)).toEqual([
      "strong",
      "later-but-weak",
      "weak",
    ]);
  });

  it("replaces a plugin's own registration rather than stacking it", () => {
    const reg = new UiSlotRegistry();
    reg.provide("panel", A, "mod");
    reg.provide("panel", B, "mod");
    expect(reg.list("panel")).toHaveLength(1);
    expect(reg.resolve("panel")).toBe(B);
  });

  it("gives a slot back when its owner unloads", () => {
    const reg = new UiSlotRegistry();
    reg.provide("panel", A, "builtin");
    reg.provide("panel", B, "mod");
    reg.clearOwner("mod");
    expect(reg.resolve("panel")).toBe(A);
  });

  it("notifies subscribers so a hot reload re-renders", () => {
    const reg = new UiSlotRegistry();
    const listener = vi.fn();
    const off = reg.subscribe(listener);
    const before = reg.getSnapshot();
    reg.provide("panel", A, "mod");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(reg.getSnapshot()).toBeGreaterThan(before);
    off();
    reg.provide("panel", B, "mod");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
