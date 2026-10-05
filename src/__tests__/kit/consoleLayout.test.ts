import { describe, it, expect } from "vitest";
import { computeConsoleLayout } from "../../ui/consoleLayout.js";

describe("computeConsoleLayout", () => {
  it("fills the frame and budgets the results viewport", () => {
    const l = computeConsoleLayout({
      rows: 40,
      desiredH: 24,
      notifications: 5,
      completions: 10,
      inputMode: true,
    });
    expect(l.modalH).toBe(24);
    expect(l.bodyH).toBe(18);
    expect(l.notifH).toBe(2);
    expect(l.gap).toBe(1);
    expect(l.compH).toBe(4);
    expect(l.resultsH).toBe(7);
  });

  it("hides completions outside input mode", () => {
    const l = computeConsoleLayout({
      rows: 40,
      desiredH: 24,
      notifications: 0,
      completions: 10,
      inputMode: false,
    });
    expect(l.compH).toBe(0);
    expect(l.gap).toBe(0);
    expect(l.notifH).toBe(0);
    expect(l.resultsH).toBe(14);
  });

  it("shares ModalFrame's clamp on a short terminal", () => {
    const l = computeConsoleLayout({
      rows: 8,
      desiredH: 24,
      notifications: 1,
      completions: 0,
      inputMode: false,
    });
    expect(l.modalH).toBe(6); // avail 6, min 6
    expect(l.bodyH).toBe(1);
    expect(l.resultsH).toBe(1); // never below 1
  });
});
