import { inject } from "../../Container.js";
import Player from "../Player.js";
import NpcRegistry from "./NpcRegistry.js";
import RelationshipContent from "../../content/RelationshipContent.js";
import {
  InteractionView,
  NpcInteractionDef,
} from "./NpcInteraction.js";
import { NpcAutonomyDef } from "./NpcAutonomy.js";
import { NpcLogIncident } from "./NpcLogIncident.js";
import { NpcOfferIncident } from "./NpcOfferIncident.js";
import { applyEffectPayload } from "../effects/applyEffects.js";
import { meetsRequirements } from "../requirements.js";
import LevelManager from "../../level/LevelManager.js";
import WorldState from "../chronicle/WorldState.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import RandomService from "../../core/random/RandomService.js";
import NpcSimulation from "./NpcSimulation.js";

/** Odds/limits for the once-a-year NPC agency pass. */
const PASSIVE_CHANCE = 0.45;
const MAX_PASSIVES = 2;
const OFFER_CHANCE = 0.15;

export interface NpcDetail {
  npcId: string;
  labelKey: string;
  descKey: string;
  temperamentKey?: string;
  affinity: number;
  availableInteractions: number;
  totalInteractions: number;
  /** Current age (from the NPC's own life trajectory). */
  age?: number;
  /** i18n key for the NPC's standing (well / married / moved / deceased). */
  statusKey?: string;
  /** Life stage key (child / youth / adult / elder). */
  stageKey?: string;
  health?: number;
  wealth?: number;
  careerTier?: number;
  /** Multi-axis player bond alongside the scalar affinity. */
  bond?: { trust: number; debt: number; conflict: number };
}

/**
 * The player↔NPC layer: which interactions an NPC offers, resolving them, and
 * the yearly pass where NPCs act on their own (quiet effects, or an offer that
 * pops the choice modal).
 */
export default class RelationshipSystem {
  private registry: NpcRegistry;
  private content: RelationshipContent;
  private levelManager: LevelManager;
  private world: WorldState;
  private eventBus: TypedEventBus;
  private random: RandomService;
  private sim: NpcSimulation;

  private logSeq = 0;
  /** Offers awaiting an answer, so we can narrate the chosen outcome. */
  private pendingOffers = new Map<string, { npcId: string; def: NpcAutonomyDef }>();

  constructor() {
    this.registry = inject(NpcRegistry);
    this.content = inject(RelationshipContent);
    this.levelManager = inject(LevelManager);
    this.world = inject(WorldState);
    this.eventBus = inject(TypedEventBus);
    this.random = inject(RandomService);
    this.sim = inject(NpcSimulation);

    this.eventBus.on("choice:resolved", ({ incidentId, optionId }) => {
      const rec = this.pendingOffers.get(incidentId);
      if (!rec) return;
      this.pendingOffers.delete(incidentId);
      const opt = rec.def.options?.find((o) => o.id === optionId);
      if (opt?.resultKey) this.log(opt.resultKey);
    });
  }

  // ── lookups ────────────────────────────────────────────────────
  private resolvedInteractions(npcId: string): NpcInteractionDef[] {
    const npc = this.registry.get(npcId);
    if (!npc) return [];
    return npc.interactions && npc.interactions.length > 0
      ? npc.interactions
      : this.content.interactionsForRole(npc.roleKey);
  }

  private resolvedAutonomy(npcId: string, kind: "passive" | "offer"): NpcAutonomyDef[] {
    const npc = this.registry.get(npcId);
    if (!npc) return [];
    const base =
      npc.autonomy && npc.autonomy.length > 0
        ? npc.autonomy
        : this.content.autonomyForRole(npc.roleKey);
    return base.filter((d) => d.kind === kind);
  }

  public getInteractionsFor(npcId: string): InteractionView[] {
    const player = this.levelManager.getPlayer();
    const gone = !this.sim.isAvailable(npcId);
    return this.resolvedInteractions(npcId).map((def) => {
      let reason: InteractionView["reason"];
      const aff = player.getRelationship(npcId);
      if (gone) reason = "gone";
      else if (def.minAge !== undefined && player.age < def.minAge) reason = "age";
      else if (def.maxAge !== undefined && player.age > def.maxAge) reason = "age";
      else if (def.minAffinity !== undefined && aff < def.minAffinity) reason = "require";
      else if (!meetsRequirements(player, def.requires)) reason = "require";
      else if (player.actionPoints < (def.apCost ?? 1)) reason = "ap";
      return { def, available: reason === undefined, reason };
    });
  }

  public getDetail(npcId: string): NpcDetail | null {
    const npc = this.registry.get(npcId);
    if (!npc) return null;
    const views = this.getInteractionsFor(npcId);
    const life = this.sim.get(npcId);
    return {
      npcId,
      labelKey: npc.labelKey,
      descKey: npc.descKey,
      temperamentKey: npc.temperamentKey,
      affinity: this.levelManager.getPlayer().getRelationship(npcId),
      availableInteractions: views.filter((v) => v.available).length,
      totalInteractions: views.length,
      age: life?.age,
      statusKey: this.sim.statusKey(npcId),
      stageKey: this.sim.stageKey(npcId),
      health: life ? Math.round(life.health) : undefined,
      wealth: life ? Math.round(life.wealth) : undefined,
      careerTier: life?.careerTier,
      bond: this.sim.bond(npcId),
    };
  }

  /** A line to show when the player opens an NPC. */
  public dialogue(npcId: string): string | null {
    const keys = this.registry.get(npcId)?.dialogueKeys ?? [];
    if (keys.length === 0) return null;
    return keys[this.random.int(keys.length)] ?? null;
  }

  // ── interaction ────────────────────────────────────────────────
  public interact(npcId: string, interactionId: string): boolean {
    const view = this.getInteractionsFor(npcId).find(
      (v) => v.def.id === interactionId,
    );
    if (!view || !view.available) return false;

    const player = this.levelManager.getPlayer();
    const def = view.def;
    player.actionPoints -= def.apCost ?? 1;
    applyEffectPayload(
      player,
      {
        effects: def.effects,
        items: def.items,
        buff: def.buff,
        flag: def.flag,
        karma: def.karma,
      },
      this.world,
    );
    if (def.affinity) player.adjustRelationship(npcId, def.affinity);
    // Interactions move the multi-axis bond: kindness builds trust, conflict
    // breeds friction (and a quarrel plants guilt the player can later mend).
    if (def.affinity) {
      this.sim.adjustBond(npcId, {
        trust: Math.sign(def.affinity) * 2,
        conflict: def.affinity < 0 ? 4 : 0,
      });
    }
    this.log(def.resultKey);
    player.notify();
    this.eventBus.emit("npc:interaction", { npcId, interactionId });
    return true;
  }

  // ── yearly agency ──────────────────────────────────────────────
  /** Every known NPC with a beating heart may act; returns nothing. */
  public tickYear(player: Player): void {
    const known = this.registry
      .getAll()
      .map((n) => n.id)
      .filter((id) => player.getRelationship(id) > 0);
    if (known.length === 0) return;

    // NPCs live their own lives first: age + life events (marriage, promotion,
    // illness, moving away, death). Only known faces are narrated.
    for (const ev of this.sim.tickYear()) {
      if (player.getRelationship(ev.npcId) > 0) this.log(`npc.life.${ev.kind}`);
    }

    const present = known.filter((id) => this.sim.isAvailable(id));

    let applied = 0;
    for (const npcId of this.random.shuffle(present)) {
      if (applied >= MAX_PASSIVES) break;
      if (this.random.next() > PASSIVE_CHANCE) continue;
      const def = this.weightedPick(this.eligible(npcId, "passive", player));
      if (!def) continue;
      this.applyPassive(npcId, def, player);
      applied++;
    }

    if (present.length > 0 && this.random.next() < OFFER_CHANCE) {
      const npcId = this.random.shuffle(present)[0];
      const def = this.weightedPick(this.eligible(npcId, "offer", player));
      if (def) this.offerNpcChoice(npcId, def);
    }
  }

  private weightedPick<T extends { weight: number }>(
    items: T[],
  ): T | undefined {
    return this.random.weighted(items, (item) => item.weight);
  }

  private eligible(
    npcId: string,
    kind: "passive" | "offer",
    player: Player,
  ): NpcAutonomyDef[] {
    const aff = player.getRelationship(npcId);
    return this.resolvedAutonomy(npcId, kind).filter((d) => {
      if (d.minAffinity !== undefined && aff < d.minAffinity) return false;
      if (d.maxAffinity !== undefined && aff > d.maxAffinity) return false;
      if (d.minAge !== undefined && player.age < d.minAge) return false;
      if (d.maxAge !== undefined && player.age > d.maxAge) return false;
      if (d.kind === "offer" && (!d.options || d.options.length === 0)) return false;
      return true;
    });
  }

  private applyPassive(npcId: string, def: NpcAutonomyDef, player: Player): void {
    applyEffectPayload(
      player,
      { effects: def.effects, items: def.items, buff: def.buff, flag: def.flag },
      this.world,
    );
    if (def.affinity) player.adjustRelationship(npcId, def.affinity);
    this.log(def.resultKey ?? def.labelKey);
    this.eventBus.emit("toast", { textKey: def.labelKey, kind: "info" });
    this.eventBus.emit("npc:acted", { npcId, autonomyId: def.id });
    player.notify();
  }

  private offerNpcChoice(npcId: string, def: NpcAutonomyDef): void {
    const incident = new NpcOfferIncident(npcId, def);
    this.pendingOffers.set(incident.id, { npcId, def });
    this.levelManager.offerNpcChoice(incident);
  }

  private log(nameKey: string): void {
    this.levelManager
      .getCurrentLogStore()
      ?.addEvent(new NpcLogIncident(`npc_log_${++this.logSeq}`, nameKey));
  }
}
