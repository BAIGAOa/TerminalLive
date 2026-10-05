import { describe, it, expect, beforeEach } from "vitest";
import { container } from "../../Container.js";
import Player from "../../world/Player.js";
import NpcRegistry from "../../world/relationships/NpcRegistry.js";
import RelationshipContent from "../../content/RelationshipContent.js";
import RelationshipSystem from "../../world/relationships/RelationshipSystem.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import WorldManager from "../../worlds/WorldManager.js";
import WorldState from "../../world/chronicle/WorldState.js";
import RandomService from "../../core/random/RandomService.js";
import { inWindow, stampWindow } from "../../world/relationships/AgeWindow.js";
import { ROLE_KNOW_WINDOW } from "../../world/relationships/NpcRoles.js";
import type { RandomSource } from "../../core/random/RandomSource.js";

/** A deterministic stream: every roll passes, shuffle keeps order, pick first. */
const alwaysLow: RandomSource = {
  next: () => 0.1,
  int: () => 0,
  range: (min) => min,
  bool: () => true,
  weighted: (items) => items[0],
  weightedIndex: () => 0,
  sample: (items, count) => items.slice(0, count),
  shuffle: (items) => [...items],
  normal: () => 0,
  poisson: () => 0,
  snapshot: () => ({ seed: 0, step: 0 }),
  restore: () => {},
};

interface Harness {
  player: Player;
  system: RelationshipSystem;
  offers: string[];
}

/**
 * A boss and a rival start out *met* (affinity > 0) but must not be part of a
 * toddler's life — the regression for "boss asks a 2-year-old to work overtime".
 */
function setup(): Harness {
  const player = new Player({ playerName: "Toddler", age: 2 });
  player.actionPoints = 3;

  const npcReg = new NpcRegistry();
  npcReg.register({
    id: "npc_boss",
    labelKey: "npc.boss",
    descKey: "npc.boss.desc",
    roleKey: "npc.role.work",
    initial: 20,
  });
  npcReg.register({
    id: "npc_rival",
    labelKey: "npc.rival",
    descKey: "npc.rival.desc",
    roleKey: "npc.role.rival",
    initial: 10,
  });
  npcReg.register({
    id: "npc_mom",
    labelKey: "npc.mom",
    descKey: "npc.mom.desc",
    roleKey: "npc.role.family",
    initial: 70,
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
  container.register(WorldManager, levelManager as unknown as WorldManager);
  container.register(WorldState, {} as unknown as WorldState);
  container.register(RandomService, alwaysLow as unknown as RandomService);

  return { player, system: new RelationshipSystem(), offers };
}

describe("NPC age gating", () => {
  let h: Harness;
  beforeEach(() => {
    h = setup();
  });

  it("AgeWindow helpers are inclusive and def bounds win", () => {
    expect(inWindow(2, { min: 3 })).toBe(false);
    expect(inWindow(3, { min: 3 })).toBe(true);
    expect(inWindow(18, { min: 18 })).toBe(true);
    expect(inWindow(200, undefined)).toBe(true);

    const stamped = stampWindow({ minAge: undefined, maxAge: undefined, id: "x" }, { min: 3 });
    expect(stamped.minAge).toBe(3);
    const kept = stampWindow({ minAge: 10, maxAge: undefined, id: "x" }, { min: 3 });
    expect(kept.minAge).toBe(10); // the def's own bound is not overridden
  });

  it("a boss/rival is not known to a toddler", () => {
    expect(ROLE_KNOW_WINDOW["npc.role.work"].min).toBe(18);
    expect(h.system.isKnown("npc_boss")).toBe(false);
    expect(h.system.isKnown("npc_rival")).toBe(false);
    expect(h.system.isKnown("npc_mom")).toBe(true);
  });

  it("all of a not-yet-known NPC's interactions read 'unknown'", () => {
    const views = h.system.getInteractionsFor("npc_boss");
    expect(views.length).toBeGreaterThan(0);
    expect(views.every((v) => !v.available && v.reason === "unknown")).toBe(true);
  });

  it("no work/mentor/rival autonomy fires for a toddler", () => {
    h.system.tickYear(h.player);
    // The boss and rival are gated out entirely; only family acts.
    expect(h.offers.some((id) => id.includes("work"))).toBe(false);
    expect(h.offers.some((id) => id.includes("rival"))).toBe(false);
    expect(h.offers.every((id) => id.includes("npc_mom"))).toBe(true);
  });

  it("once the player comes of age, work autonomy is reachable", () => {
    h.player.age = 18;
    expect(h.system.isKnown("npc_boss")).toBe(true);
    h.system.tickYear(h.player);
    expect(h.offers.some((id) => id.includes("work"))).toBe(true);
  });
});
