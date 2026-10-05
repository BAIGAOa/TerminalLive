import { describe, it, expect } from "vitest";
import {
  affinityColor,
  CARD_HEIGHT,
  fitRelationshipPanel,
  ROLE_ICON,
} from "../../ui/gameStatus/relationshipLayout.js";

const COLORS = { success: "S", warning: "W", text: "T", danger: "D" };

describe("affinityColor", () => {
  it("maps affinity bands to theme colors", () => {
    expect(affinityColor(70, COLORS)).toBe("S");
    expect(affinityColor(69, COLORS)).toBe("W");
    expect(affinityColor(40, COLORS)).toBe("W");
    expect(affinityColor(39, COLORS)).toBe("T");
    expect(affinityColor(20, COLORS)).toBe("T");
    expect(affinityColor(19, COLORS)).toBe("D");
  });
});

describe("ROLE_ICON", () => {
  it("has an icon for every known role", () => {
    expect(ROLE_ICON["npc.role.family"]).toBe("👪");
    expect(ROLE_ICON["npc.role.pet"]).toBe("🐾");
  });
});

describe("fitRelationshipPanel", () => {
  it("shows the detail box when there is room and caps at the card count", () => {
    const l = fitRelationshipPanel(30, 5);
    expect(l.showDetail).toBe(true);
    expect(l.listRows).toBe(7);
    expect(l.shown).toBe(5);
    expect(l.hidden).toBe(0);
    expect(l.listHeight).toBe(5 * CARD_HEIGHT);
  });

  it("hides the detail box when there is not room", () => {
    const l = fitRelationshipPanel(8, 4);
    expect(l.showDetail).toBe(false);
    expect(l.listRows).toBe(2);
    expect(l.shown).toBe(2);
    expect(l.hidden).toBe(2);
  });

  it("always leaves room for at least one card", () => {
    const l = fitRelationshipPanel(4, 3);
    expect(l.listRows).toBe(1);
    expect(l.shown).toBe(1);
  });

  it("handles an empty list", () => {
    const l = fitRelationshipPanel(30, 0);
    expect(l.shown).toBe(0);
    expect(l.hidden).toBe(0);
    expect(l.listHeight).toBe(0);
  });
});
