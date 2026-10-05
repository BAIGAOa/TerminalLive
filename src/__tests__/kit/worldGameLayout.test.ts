import { describe, it, expect } from "vitest";
import { computeWorldGameLayout } from "../../ui/worldGameLayout.js";

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
