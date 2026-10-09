import { describe, it, expect } from "vitest";
import {
  completionWindow,
  computeConsoleLayout,
} from "../../ui/consoleLayout.js";

/** A roomy terminal, so only the layout's own arithmetic is under test. */
const base = {
  rows: 40,
  columns: 100,
  desiredH: 24,
  desiredW: 76,
};

describe("computeConsoleLayout", () => {
  it("fills the frame and budgets the results viewport", () => {
    const l = computeConsoleLayout({
      ...base,
      notifications: 5,
      completions: 10,
      inputMode: true,
    });
    expect(l.modalH).toBe(24);
    expect(l.bodyH).toBe(18);
    expect(l.notifH).toBe(2);
    expect(l.gap).toBe(1);
    expect(l.compH).toBe(6); // capped, not one row per candidate
    expect(l.descH).toBe(0); // nothing typed yet — no help to show
    expect(l.resultsH).toBe(5);
    expect(l.resultsW).toBe(68); // frame width − chrome − scrollbar + margin
  });

  it("narrows the results text on a terminal narrower than the frame", () => {
    const l = computeConsoleLayout({
      ...base,
      columns: 50,
      notifications: 0,
      completions: 0,
      inputMode: false,
    });
    // Frame clamped to columns − 2 = 48, minus frame chrome (−6) and the
    // scrollbar cell and its margin (−2).
    expect(l.resultsW).toBe(40);
  });

  it("hides completions outside input mode", () => {
    const l = computeConsoleLayout({
      ...base,
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
      ...base,
      rows: 8,
      notifications: 1,
      completions: 0,
      inputMode: false,
    });
    expect(l.modalH).toBe(6); // avail 6, min 6
    expect(l.bodyH).toBe(1);
    expect(l.resultsH).toBe(1); // never below 1
  });

  it("never lets the menu eat the results", () => {
    // A one-row frame: there is no room for a menu at all, so none is drawn
    // rather than starving the results viewport.
    const l = computeConsoleLayout({
      ...base,
      rows: 8,
      notifications: 1,
      completions: 200,
      inputMode: true,
    });
    expect(l.compH).toBe(0);
    expect(l.resultsH).toBe(1);
  });

  it("takes the help rows out of the results viewport", () => {
    const noHelp = computeConsoleLayout({
      ...base,
      notifications: 0,
      completions: 0,
      inputMode: true,
    });
    // Nothing to describe yet — no help rows.
    expect(noHelp.descH).toBe(0);
    expect(noHelp.resultsH).toBe(14);

    const withSummary = computeConsoleLayout({
      ...base,
      notifications: 0,
      completions: 0,
      inputMode: true,
      description: { name: "play", summary: "starts a life" },
    });
    expect(withSummary.descH).toBe(1);
    expect(withSummary.resultsH).toBe(13);

    const withUsage = computeConsoleLayout({
      ...base,
      notifications: 0,
      completions: 0,
      inputMode: true,
      description: { name: "play", summary: "starts a life", usage: "play <stage>" },
    });
    expect(withUsage.descH).toBe(2);
    expect(withUsage.resultsH).toBe(12);
  });

  it("drops the help rows outside input mode", () => {
    const l = computeConsoleLayout({
      ...base,
      notifications: 0,
      completions: 0,
      inputMode: false,
      description: { name: "play", summary: "starts a life" },
    });
    expect(l.descH).toBe(0);
  });
});

describe("completionWindow", () => {
  it("starts at the top while everything fits", () => {
    expect(completionWindow(0, 4, 6)).toBe(0);
    expect(completionWindow(3, 4, 6)).toBe(0);
    expect(completionWindow(0, 0, 6)).toBe(0);
    expect(completionWindow(0, 10, 0)).toBe(0);
  });

  it("keeps the highlight near the middle of a long list", () => {
    // Rows 7..12 for a 6-row window — the highlight is the 4th of them.
    expect(completionWindow(10, 200, 6)).toBe(7);
  });

  it("clamps at both ends instead of scrolling past the list", () => {
    expect(completionWindow(0, 200, 6)).toBe(0);
    expect(completionWindow(199, 200, 6)).toBe(194);
  });
});
