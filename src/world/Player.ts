import { container } from "../Container.js";
import EffectRegistry from "./effects/EffectRegistry.js";
import ItemRegistry from "./items/ItemRegistry.js";
import {
  clampStat,
  deltaEntries,
  scaleDelta,
  StatDelta,
  StatKey,
} from "./stats.js";

export interface PlayerAttributes {
  playerName?: string;
  age?: number;
  health?: number;
  height?: number;
  weight?: number;
  money?: number;
  intelligence?: number;
  social?: number;
  fitness?: number;
  happiness?: number;
  reputation?: number;
  angerValue?: number;
  excitationValue?: number;
  depressionValue?: number;
  weakValue?: number;
  // Transient state, persisted so a saved life resumes correctly.
  effects?: ActiveEffect[];
  inventory?: InventoryStack[];
  relationships?: Record<string, number>;
  flags?: string[];
  actionPoints?: number;
}

export interface ActiveEffect {
  id: string;
  remaining: number;
  stacks: number;
}

export interface InventoryStack {
  id: string;
  count: number;
}

/** Psych values that spawn a timed effect once they cross the threshold. */
const PSYCH_DRIVERS: Array<{ valueKey: StatKey; effectId: string }> = [
  { valueKey: "angerValue", effectId: "fx_rage" },
  { valueKey: "excitationValue", effectId: "fx_mania" },
  { valueKey: "depressionValue", effectId: "fx_gloom" },
  { valueKey: "weakValue", effectId: "fx_fatigue" },
];

const PSYCH_THRESHOLD = 70;

export default class Player {
  public playerName: string;
  public age: number;
  public health: number;
  public height: number;
  public weight: number;
  public money: number;

  public intelligence: number;
  public social: number;
  public fitness: number;
  public happiness: number;
  public reputation: number;

  public angerValue: number;
  public excitationValue: number;
  public depressionValue: number;
  public weakValue: number;

  /** Action points left this turn/year. */
  public actionPoints = 0;
  public alive = true;

  public activeEffects: ActiveEffect[] = [];
  public inventory: InventoryStack[] = [];
  public relationships = new Map<string, number>();
  public flags = new Set<string>();

  private listeners = new Set<() => void>();

  constructor(attrs: PlayerAttributes) {
    this.playerName = attrs.playerName || "You";
    this.age = attrs.age ?? 0;
    this.health = attrs.health ?? 100;
    this.height = attrs.height ?? 1.55;
    this.weight = attrs.weight ?? 45;
    this.money = attrs.money ?? 0;

    this.intelligence = attrs.intelligence ?? 10;
    this.social = attrs.social ?? 10;
    this.fitness = attrs.fitness ?? 10;
    this.happiness = attrs.happiness ?? 60;
    this.reputation = attrs.reputation ?? 0;

    this.angerValue = attrs.angerValue ?? 0;
    this.excitationValue = attrs.excitationValue ?? 0;
    this.depressionValue = attrs.depressionValue ?? 0;
    this.weakValue = attrs.weakValue ?? 0;

    // Restore transient state when present (e.g. resuming a saved life).
    if (attrs.effects) this.activeEffects = attrs.effects.map((e) => ({ ...e }));
    if (attrs.inventory) this.inventory = attrs.inventory.map((s) => ({ ...s }));
    if (attrs.relationships) {
      this.relationships = new Map(Object.entries(attrs.relationships));
    }
    if (attrs.flags) this.flags = new Set(attrs.flags);

    this.recomputeActionPoints();
    if (attrs.actionPoints !== undefined) this.actionPoints = attrs.actionPoints;
    this.alive = this.health > 0;
    this.syncPsychEffects();
  }

  /** Reset everything for a brand-new life (used when starting a root level). */
  public resetForNewLife(base: PlayerAttributes): void {
    this.playerName = base.playerName ?? this.playerName;
    this.age = base.age ?? 0;
    this.health = base.health ?? 100;
    this.height = base.height ?? 1.55;
    this.weight = base.weight ?? 45;
    this.money = base.money ?? 0;

    this.intelligence = base.intelligence ?? 10;
    this.social = base.social ?? 10;
    this.fitness = base.fitness ?? 10;
    this.happiness = base.happiness ?? 60;
    this.reputation = base.reputation ?? 0;

    this.angerValue = base.angerValue ?? 0;
    this.excitationValue = base.excitationValue ?? 0;
    this.depressionValue = base.depressionValue ?? 0;
    this.weakValue = base.weakValue ?? 0;

    this.activeEffects = [];
    this.inventory = [];
    this.relationships = new Map();
    this.flags = new Set();

    this.recomputeActionPoints();
    this.alive = this.health > 0;
    this.notify();
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // ── stat access ────────────────────────────────────────────────
  public getStat(key: StatKey): number {
    return (this as unknown as Record<StatKey, number>)[key];
  }

  public setStat(key: StatKey, value: number): void {
    (this as unknown as Record<StatKey, number>)[key] = clampStat(key, value);
  }

  public applyDelta(delta: StatDelta): void {
    for (const [key, value] of deltaEntries(delta)) {
      this.setStat(key, this.getStat(key) + value);
    }
    // A spike from an event/item can cross a psych threshold mid-turn; spawn
    // the matching effect immediately instead of waiting for the next year.
    this.syncPsychEffects();
  }

  // ── effects ────────────────────────────────────────────────────
  public hasEffect(id: string): boolean {
    return this.activeEffects.some((e) => e.id === id);
  }

  public addEffect(id: string, turns?: number, stacks = 1): void {
    const def = container.resolve(EffectRegistry).get(id);
    if (!def) return;
    const max = def.maxStacks ?? 1;
    const duration = turns ?? def.turns;
    const existing = this.activeEffects.find((e) => e.id === id);
    if (existing) {
      existing.stacks = Math.min(max, existing.stacks + stacks);
      existing.remaining = Math.max(existing.remaining, duration);
    } else {
      this.activeEffects = [
        ...this.activeEffects,
        { id, remaining: duration, stacks: Math.min(max, stacks) },
      ];
    }
  }

  public removeEffect(id: string): void {
    this.activeEffects = this.activeEffects.filter((e) => e.id !== id);
  }

  // ── inventory ──────────────────────────────────────────────────
  public getItemCount(id: string): number {
    return this.inventory.find((s) => s.id === id)?.count ?? 0;
  }

  public addItem(id: string, count = 1): void {
    if (count <= 0) return;
    const stack = this.inventory.find((s) => s.id === id);
    if (stack) stack.count += count;
    else this.inventory = [...this.inventory, { id, count }];
  }

  public removeItem(id: string, count = 1): void {
    if (count <= 0) return;
    this.inventory = this.inventory
      .map((s) => (s.id === id ? { ...s, count: s.count - count } : s))
      .filter((s) => s.count > 0);
  }

  public useItem(id: string): boolean {
    const def = container.resolve(ItemRegistry).get(id);
    if (!def || !def.usable || this.getItemCount(id) <= 0) return false;
    // Using an item costs an action point, so non-consumable items cannot be
    // farmed for infinite stats.
    if (this.actionPoints < 1) return false;
    this.actionPoints -= 1;
    if (def.effects) this.applyDelta(def.effects);
    if (def.buff) this.addEffect(def.buff.id, def.buff.turns);
    if (def.consumable !== false) this.removeItem(id, 1);
    this.notify();
    return true;
  }

  // ── relationships ──────────────────────────────────────────────
  /** Seed starting affinities from the NPC registry (called once at init).
   *  Restored values (from a save) are kept, not overwritten. */
  public seedRelationships(defs: Array<{ id: string; initial?: number }>): void {
    for (const npc of defs) {
      if (!this.relationships.has(npc.id)) {
        this.relationships.set(npc.id, npc.initial ?? 0);
      }
    }
  }

  public getRelationship(npcId: string): number {
    return this.relationships.get(npcId) ?? 0;
  }

  public adjustRelationship(npcId: string, delta: number): void {
    const next = Math.max(0, Math.min(100, this.getRelationship(npcId) + delta));
    this.relationships = new Map(this.relationships).set(npcId, next);
  }

  // ── flags ──────────────────────────────────────────────────────
  public setFlag(flag: string): void {
    this.flags.add(flag);
  }

  public hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  // ── turn ───────────────────────────────────────────────────────
  public maxActionPoints(): number {
    let ap = 2;
    if (this.fitness >= 60) ap += 1;
    if (this.health >= 80) ap += 1;
    if (this.happiness >= 70) ap += 1;
    return Math.min(4, ap);
  }

  public recomputeActionPoints(): void {
    this.actionPoints = this.maxActionPoints();
  }

  /** Spawn/refresh timed effects driven by high psych values. */
  public syncPsychEffects(): void {
    const reg = container.resolve(EffectRegistry);
    for (const { valueKey, effectId } of PSYCH_DRIVERS) {
      if (this.getStat(valueKey) >= PSYCH_THRESHOLD && reg.has(effectId)) {
        this.addEffect(effectId);
      }
    }
  }

  /** Advance one year: apply active effects, age, drift, re-derive state. */
  public tickYear(): void {
    this.age += 1;

    const reg = container.resolve(EffectRegistry);
    const next: ActiveEffect[] = [];
    for (const eff of this.activeEffects) {
      const def = reg.get(eff.id);
      if (def?.perTurn) this.applyDelta(scaleDelta(def.perTurn, eff.stacks));
      const remaining = eff.remaining - 1;
      if (remaining > 0) next.push({ ...eff, remaining });
    }
    this.activeEffects = next;

    // Psych drift: high-arousal states fade year over year; gloom eases as
    // mood recovers. Without this, threshold effects never expire.
    this.angerValue = Math.max(0, this.angerValue - 1);
    this.excitationValue = Math.max(0, this.excitationValue - 2);
    if (this.happiness >= 55) {
      this.depressionValue = Math.max(0, this.depressionValue - 2);
    }
    this.weakValue = Math.max(0, this.weakValue - 2);

    this.syncPsychEffects();
    this.recomputeActionPoints();
    this.alive = this.health > 0;
    this.notify();
  }

  public applyAttributes(attrs: Partial<PlayerAttributes>): void {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined) continue;
      if (k === "playerName") {
        this.playerName = String(v);
      } else if (typeof v === "number") {
        this.setStat(k as StatKey, v);
      }
    }
    this.syncPsychEffects();
    this.notify();
  }
}
