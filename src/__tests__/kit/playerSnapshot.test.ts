import { describe, it, expect } from "vitest";
import { relationshipDigest } from "../../ui/playerSnapshot.js";

describe("relationshipDigest", () => {
  it("serializes every id:value pair in iteration order", () => {
    expect(
      relationshipDigest([
        ["alice", 10],
        ["bob", 3],
      ]),
    ).toBe("alice:10,bob:3");
  });

  it("changes when an existing affinity changes (size unchanged)", () => {
    const before = relationshipDigest([["alice", 10]]);
    const after = relationshipDigest([["alice", 70]]);
    expect(before).not.toBe(after);
  });

  it("is empty for no relationships", () => {
    expect(relationshipDigest([])).toBe("");
  });
});
