import { describe, it, expect } from "vitest";
import { computeWorldGameLayout } from "../../ui/worldGameLayout.js";

describe("the widths the middle row hands out", () => {
  const sizes = [140, 120, 100, 80, 70, 60, 50, 40, 30];

  it("gives both panels a usable inner width at every terminal size", () => {
    for (const columns of sizes) {
      const l = computeWorldGameLayout(40, columns, 1, 3);
      expect(l.actionsInnerW).toBeGreaterThan(0);
      expect(l.carouselInnerW).toBeGreaterThan(0);
    }
  });

  it("gives the status panel exactly the row's leftover space, no more", () => {
    // The bug this guards: a status view measured `useWindowSize()` — the whole
    // terminal — while rendering into one column of the middle row, so it laid
    // out two columns of cards across a panel half that wide and ink clipped
    // the excess at the screen edge. Text cut off mid-word, no error anywhere.
    for (const columns of sizes) {
      const l = computeWorldGameLayout(40, columns, 1, 3);
      // Screen padding, then the actions column and its gap, then the status
      // panel's own border and padding.
      const leftover = columns - 2 - l.actionsW - 1 - 4;
      expect(l.carouselInnerW).toBe(Math.max(8, leftover));
    }
  });

  it("keeps the action panel's contents inside its own border", () => {
    for (const columns of sizes) {
      const l = computeWorldGameLayout(40, columns, 1, 3);
      expect(l.actionsInnerW).toBe(l.actionsW - 4);
    }
  });

  it("leaves the actions column a set width, not one yoga may squeeze", () => {
    // `WorldGame` pins it with `flexShrink={0}` precisely so this holds: if it
    // is allowed to shrink, the two boxes disagree about where the boundary is
    // and the carousel draws into the actions column.
    const wide = computeWorldGameLayout(40, 100, 0, 0);
    const narrow = computeWorldGameLayout(40, 60, 0, 0);
    expect(wide.actionsW).toBeGreaterThan(narrow.actionsW);
    expect(narrow.actionsW).toBeGreaterThanOrEqual(18);
    expect(wide.actionsW).toBeLessThanOrEqual(38);
  });
});

describe("computeWorldGameLayout", () => {
  it("shows the journal and a full 3-line hint on a tall terminal", () => {
    const l = computeWorldGameLayout(40, 100, 0, 0);
    expect(l.hintH).toBe(3);
    expect(l.short).toBe(false);
    expect(l.actionsW).toBe(34);
    expect(l.journalH).toBe(9);
    expect(l.showJournal).toBe(true);
    expect(l.middleH).toBe(20);
    expect(l.carouselContentH).toBe(17);
    expect(l.journalInner).toBe(4);
    expect(l.maxJournalOffset).toBe(0);
  });

  it("computes the journal End offset from the log count", () => {
    const l = computeWorldGameLayout(40, 100, 0, 10);
    expect(l.maxJournalOffset).toBe(6); // 10 logs - 4 inner rows
  });

  it("reserves victory-condition rows from the carousel", () => {
    const l = computeWorldGameLayout(40, 100, 4, 0);
    expect(l.carouselContentH).toBe(13); // 17 - 4
  });

  it("drops the journal and the scene row on a short terminal", () => {
    const l = computeWorldGameLayout(20, 80, 2, 5);
    expect(l.hintH).toBe(2);
    expect(l.short).toBe(true);
    expect(l.showJournal).toBe(false);
    expect(l.journalH).toBe(0);
    expect(l.journalInner).toBe(1);
    expect(l.maxJournalOffset).toBe(4);
    expect(l.carouselContentH).toBe(5); // middleH 10 - 3 - 2 victory rows
  });

  it("never lets the middle row fall below 4", () => {
    const l = computeWorldGameLayout(12, 40, 0, 0);
    expect(l.hintH).toBe(1);
    expect(l.middleH).toBe(4);
    expect(l.carouselContentH).toBe(3); // max(3, 4 - 3) floors at 3
  });
});
