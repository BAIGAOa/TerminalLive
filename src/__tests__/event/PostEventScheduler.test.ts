import { describe, it, expect } from "vitest";
import PostEventScheduler from "../../event/PostEventScheduler.js";

describe("PostEventScheduler", () => {
  it("delay = 0 fires on the next advance", () => {
    const s = new PostEventScheduler();
    s.add({ sourceId: "src", targetId: "a", delay: 0 });
    expect(s.advanceRound().map((i) => i.targetId)).toEqual(["a"]);
    expect(s.advanceRound()).toEqual([]);
  });

  it("delay = D fires after D skipped rounds (the (D+1)-th advance)", () => {
    const s = new PostEventScheduler();
    s.add({ sourceId: "src", targetId: "b", delay: 2 });
    expect(s.advanceRound()).toEqual([]); // delay 2 -> 1
    expect(s.advanceRound()).toEqual([]); // delay 1 -> 0
    expect(s.advanceRound().map((i) => i.targetId)).toEqual(["b"]);
  });

  it("preserves relative order and fires multiple due items together", () => {
    const s = new PostEventScheduler();
    s.add({ sourceId: "src", targetId: "a", delay: 0 });
    s.add({ sourceId: "src", targetId: "b", delay: 0 });
    expect(s.advanceRound().map((i) => i.targetId)).toEqual(["a", "b"]);
  });

  it("normalizes a negative delay to zero so it cannot stall forever", () => {
    const s = new PostEventScheduler();
    s.add({ sourceId: "src", targetId: "a", delay: -5 });
    expect(s.advanceRound().map((i) => i.targetId)).toEqual(["a"]);
  });

  it("snapshot is closure-free and round-trips through restore", () => {
    const s = new PostEventScheduler();
    s.add({
      sourceId: "src",
      targetId: "t",
      delay: 3,
      weight: 2,
      edgeIndex: 1,
      condition: () => true,
      edge: { incident: "t" },
    });
    const snap = s.snapshot();
    expect(snap).toHaveLength(1);
    // No functions survive serialization.
    expect(JSON.parse(JSON.stringify(snap))).toStrictEqual(snap);
    expect(snap[0]).toMatchObject({
      sourceId: "src",
      targetId: "t",
      delay: 3,
      weight: 2,
      edgeIndex: 1,
    });
    expect("condition" in snap[0]).toBe(false);
    expect("edge" in snap[0]).toBe(false);

    const restored = new PostEventScheduler();
    restored.restore(snap);
    expect(restored.size()).toBe(1);
    expect(restored.snapshot()).toStrictEqual(snap);
  });

  it("reset clears the queue", () => {
    const s = new PostEventScheduler();
    s.add({ sourceId: "src", targetId: "a", delay: 0 });
    s.reset();
    expect(s.size()).toBe(0);
    expect(s.advanceRound()).toEqual([]);
  });
});
