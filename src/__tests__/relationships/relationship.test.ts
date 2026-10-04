import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { container } from "../../Container.js";
import Player from "../../world/Player.js";
import NpcRegistry from "../../world/relationships/NpcRegistry.js";
import RelationshipContent from "../../content/RelationshipContent.js";
import RelationshipSystem from "../../world/relationships/RelationshipSystem.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import LevelManager from "../../level/LevelManager.js";
import WorldState from "../../world/chronicle/WorldState.js";

interface Harness {
  player: Player;
  system: RelationshipSystem;
  offers: string[];
}

function setup(): Harness {
  const player = new Player({ playerName: "Tester" });
  player.actionPoints = 3;

  const npcReg = new NpcRegistry();
  npcReg.register({
    id: "npc_friend",
    labelKey: "npc.friend",
    descKey: "npc.friend.desc",
    roleKey: "npc.role.friend",
    initial: 40,
  });
  npcReg.register({
    id: "npc_pet",
    labelKey: "npc.pet",
    descKey: "npc.pet.desc",
    roleKey: "npc.role.pet",
    initial: 0,
  });
  player.seedRelationships(npcReg.getAll());

  const content = new RelationshipContent();
  content.load();

  const offers: string[] = [];
  const levelManager = {
    getPlayer: () => player,
    getCurrentLogStore: () => ({ addEvent: () => {} }),
    offerNpcChoice: (incident: { id: string }) => offers.push(incident.id),
  };

  container.register(NpcRegistry, npcReg);
  container.register(RelationshipContent, content);
  container.register(TypedEventBus, new TypedEventBus());
  container.register(LevelManager, levelManager as unknown as LevelManager);
  container.register(WorldState, {} as unknown as WorldState);

  return { player, system: new RelationshipSystem(), offers };
}

describe("RelationshipSystem", () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });
  afterEach(() => vi.restoreAllMocks());

  it("gates interactions by affinity, money and action points", () => {
    const views = h.system.getInteractionsFor("npc_friend");
    const byId = Object.fromEntries(views.map((v) => [v.def.id, v]));
    // Friend starts at 40 → confide (needs 30) is open.
    expect(byId.it_talk.available).toBe(true);
    expect(byId.it_confide.available).toBe(true);
    // No money → gift is gated by its `money >= 5` requirement.
    expect(byId.it_gift.available).toBe(false);
    expect(byId.it_gift.reason).toBe("require");

    h.player.actionPoints = 0;
    expect(h.system.getInteractionsFor("npc_friend")[0].available).toBe(false);
    expect(h.system.getInteractionsFor("npc_friend")[0].reason).toBe("ap");
  });

  it("applies effects and affinity and spends an action point", () => {
    const before = {
      ap: h.player.actionPoints,
      aff: h.player.getRelationship("npc_friend"),
      hap: h.player.happiness,
    };
    expect(h.system.interact("npc_friend", "it_talk")).toBe(true);
    expect(h.player.actionPoints).toBe(before.ap - 1);
    expect(h.player.getRelationship("npc_friend")).toBe(before.aff + 3);
    expect(h.player.happiness).toBe(before.hap + 2);
  });

  it("refuses an interaction whose gate is unmet", () => {
    expect(h.system.interact("npc_friend", "it_gift")).toBe(false); // no money
    expect(h.player.actionPoints).toBe(3); // unchanged
  });

  it("makes an unrelated pet invisible to eligibility", () => {
    // The pet starts at 0 → not "known", so its autonomy never runs.
    const detail = h.system.getDetail("npc_pet");
    expect(detail?.affinity).toBe(0);
  });

  it("runs NPC agency each year: a passive effect and an offer", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1); // always passes both rolls
    const hapBefore = h.player.happiness;
    h.system.tickYear(h.player);
    // A friend passive (gift/gossip) raised happiness…
    expect(h.player.happiness).toBeGreaterThan(hapBefore);
    // …and an offer was raised through the level manager.
    expect(h.offers.length).toBe(1);
    expect(h.offers[0]).toContain("npc_offer_");
  });
});
