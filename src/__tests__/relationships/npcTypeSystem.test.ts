import { describe, it, expect } from "vitest";
import { container } from "../../Container.js";
import NpcTypeRegistry from "../../world/relationships/NpcTypeRegistry.js";
import NpcTypes, { NPC_TYPES } from "../../world/relationships/NpcTypes.js";
import NpcRegistry from "../../world/relationships/NpcRegistry.js";
import { Npc } from "../../world/relationships/Npc.js";
import type { NpcDefinition } from "../../world/relationships/NpcDefinition.js";
import type { NpcTraits } from "../../world/relationships/NpcState.js";

function def(over: Partial<NpcDefinition>): NpcDefinition {
  return { id: "x", labelKey: "x", descKey: "x", ...over };
}

/** A mod-style archetype with a custom field parsed out of `params`. */
class BountyHunterNpc extends Npc {
  public wanted = "";
  protected parseParams(params: Record<string, unknown>): void {
    if (typeof params.wanted === "string") this.wanted = params.wanted;
  }
  public traits(): NpcTraits {
    return { warmth: -0.9, ambition: 1, stability: 0.2, sociability: 0.3 };
  }
  public knowsAt(playerAge: number): boolean {
    return playerAge >= 40;
  }
}

describe("NPC type system", () => {
  it("infers the archetype from roleKey when type is absent", () => {
    NpcTypes.registerAll();
    const reg = container.resolve(NpcTypeRegistry);

    const rival = reg.createForDef(def({ id: "r", roleKey: "npc.role.rival" }));
    expect(rival).toBeInstanceOf(NPC_TYPES.rival);
    expect(rival.type).toBe("rival");

    const boss = reg.createForDef(def({ id: "b", roleKey: "npc.role.work" }));
    expect(boss).toBeInstanceOf(NPC_TYPES.work);
    expect(boss.type).toBe("work");
  });

  it("lets an explicit type win over roleKey", () => {
    NpcTypes.registerAll();
    const reg = container.resolve(NpcTypeRegistry);
    const npc = reg.createForDef(
      def({ id: "p", roleKey: "npc.role.family", type: "pet" }),
    );
    expect(npc).toBeInstanceOf(NPC_TYPES.pet);
    expect(npc.type).toBe("pet");
  });

  it("falls back to the generic archetype for an unknown type", () => {
    NpcTypes.registerAll();
    const reg = container.resolve(NpcTypeRegistry);
    const npc = reg.createForDef(def({ id: "z", type: "totally-made-up" }));
    expect(npc).toBeInstanceOf(NPC_TYPES.generic);
  });

  it("registered NPCs expose role-based know-windows and traits", () => {
    NpcTypes.registerAll();
    const reg = container.resolve(NpcTypeRegistry);
    const boss = reg.createForDef(def({ id: "b2", roleKey: "npc.role.work" }));
    expect(boss.knowsAt(2)).toBe(false);
    expect(boss.knowsAt(18)).toBe(true);
    // Work NPCs are ambitious by role.
    expect(boss.traits().ambition).toBeGreaterThan(0.5);
  });

  it("supports custom types + custom params fields (mod-style)", () => {
    const local = new NpcTypeRegistry();
    local.register("bounty", BountyHunterNpc);

    const npc = local.createForDef(
      def({ id: "h", type: "bounty", params: { wanted: "Ace" } }),
    );
    expect(npc).toBeInstanceOf(BountyHunterNpc);
    expect((npc as BountyHunterNpc).wanted).toBe("Ace");
    expect(npc.traits().warmth).toBeLessThan(0);
    // The type's own know-window is honoured.
    expect(npc.knowsAt(39)).toBe(false);
    expect(npc.knowsAt(40)).toBe(true);
  });

  it("registerIfAbsent is idempotent (hot-reload friendly)", () => {
    const local = new NpcTypeRegistry();
    expect(local.registerIfAbsent("bounty", BountyHunterNpc)).toBe(true);
    expect(local.registerIfAbsent("bounty", BountyHunterNpc)).toBe(false);
    expect(local.has("bounty")).toBe(true);
  });

  it("NpcRegistry wraps raw defs into behaviour-capable Npc instances", () => {
    const reg = new NpcRegistry();
    reg.register(def({ id: "wrapped", roleKey: "npc.role.friend" }));
    const got = reg.get("wrapped");
    expect(got).toBeInstanceOf(Npc);
    expect(got?.knowsAt(2)).toBe(false); // friend role: known from age 3
    expect(got?.knowsAt(3)).toBe(true);
  });
});
