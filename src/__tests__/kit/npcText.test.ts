import { describe, it, expect } from "vitest";
import { reasonText } from "../../ui/npcText.js";

const t = (key: string) => `T:${key}`;

describe("reasonText", () => {
  it("maps known reasons to their translation keys", () => {
    expect(reasonText("ap", t)).toBe("T:npc.it.reason.ap");
    expect(reasonText("age", t)).toBe("T:npc.it.reason.age");
    expect(reasonText("gone", t)).toBe("T:npc.it.reason.gone");
    expect(reasonText("unknown", t)).toBe("T:npc.it.reason.unknown");
  });

  it("falls back to the generic requirement reason", () => {
    expect(reasonText(undefined, t)).toBe("T:npc.it.reason.require");
    expect(reasonText("something-else", t)).toBe("T:npc.it.reason.require");
  });
});
