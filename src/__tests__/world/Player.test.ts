import { describe, it, expect, beforeEach } from "vitest";
import Player from "../../world/Player.js";
import Effects from "../../content/Effects.js";
import { container } from "../../Container.js";
import EffectRegistry from "../../world/effects/EffectRegistry.js";
import ItemRegistry from "../../world/items/ItemRegistry.js";

function makePlayer() {
  return new Player({ playerName: "Tester", age: 10, health: 50, fitness: 0, happiness: 50 });
}

describe("Player", () => {
  beforeEach(() => Effects.load());

  it("clamps gauges to 0..100", () => {
    const p = makePlayer();
    p.applyDelta({ health: 1000 });
    expect(p.health).toBe(100);
    p.applyDelta({ health: -1000 });
    expect(p.health).toBe(0);
  });

  it("keeps money non-negative but unbounded", () => {
    const p = makePlayer();
    p.applyDelta({ money: 5000 });
    expect(p.money).toBe(5000);
    p.applyDelta({ money: -99999 });
    expect(p.money).toBe(0);
  });

  it("ticks a timed effect down and removes it when expired", () => {
    const p = makePlayer();
    p.addEffect("fx_focus", 2);
    const before = p.intelligence;
    p.tickYear();
    expect(p.intelligence).toBe(before + 1);
    expect(p.hasEffect("fx_focus")).toBe(true);
    p.tickYear();
    expect(p.hasEffect("fx_focus")).toBe(false);
  });

  it("spawns a psych effect immediately when anger spikes (via applyDelta)", () => {
    const p = makePlayer();
    p.applyDelta({ angerValue: 80 });
    expect(p.hasEffect("fx_rage")).toBe(true);
  });

  it("decays high-arousal psych values each year", () => {
    const p = makePlayer();
    p.applyDelta({ excitationValue: 80 });
    p.tickYear();
    expect(p.excitationValue).toBeLessThan(80);
  });

  it("charges an action point to use an item (no infinite farming)", () => {
    const items = container.resolve(ItemRegistry);
    if (!items.has("test_item")) {
      items.register({
        id: "test_item",
        labelKey: "test_item",
        descKey: "test_item.desc",
        usable: true,
        consumable: false,
        effects: { happiness: 10 },
      });
    }
    const p = makePlayer();
    p.addItem("test_item", 1);
    p.actionPoints = 1;
    const before = p.happiness;
    expect(p.useItem("test_item")).toBe(true);
    expect(p.happiness).toBe(before + 10);
    expect(p.actionPoints).toBe(0);
    // no AP left -> cannot use again
    expect(p.useItem("test_item")).toBe(false);
  });

  it("seeds relationships only for missing NPCs", () => {
    const p = makePlayer();
    p.adjustRelationship("npc_mom", 99);
    p.seedRelationships([{ id: "npc_mom", initial: 10 }, { id: "npc_dad", initial: 20 }]);
    expect(p.getRelationship("npc_mom")).toBe(99); // kept
    expect(p.getRelationship("npc_dad")).toBe(20); // seeded
  });

  it("registers the built-in effects", () => {
    expect(container.resolve(EffectRegistry).getAll().length).toBeGreaterThanOrEqual(15);
  });
});
