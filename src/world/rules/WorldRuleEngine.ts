import { inject } from "../../Container.js";
import type { StatDelta } from "../stats.js";
import WorldRuleRegistry from "./WorldRuleRegistry.js";
import type { EventMatch, WorldRuleDef } from "./WorldRule.js";

export interface WorldStartResult {
  stat: StatDelta;
  money: number;
  flags: string[];
  pressureSeed: Record<string, number>;
}

export interface WorldEconomyBiasResult {
  inflationBias: number;
  marketBias: number;
  wageMul: number;
}

function addDelta(into: StatDelta, d: StatDelta): void {
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === "number") into[k as keyof StatDelta] = (into[k as keyof StatDelta] ?? 0) + v;
  }
}

function matchEvent(
  m: EventMatch,
  tags: ReadonlySet<string>,
  id: string,
  category: string | null | undefined,
): boolean {
  if (m.id !== undefined && m.id !== id) return false;
  if (m.category !== undefined && m.category !== (category ?? undefined)) return false;
  if (m.tag !== undefined && !tags.has(m.tag)) return false;
  return true;
}

function matchNpc(
  m: { role?: string; tag?: string },
  role: string | undefined,
  tags: ReadonlySet<string>,
): boolean {
  if (m.role !== undefined && m.role !== role) return false;
  if (m.tag !== undefined && !tags.has(m.tag)) return false;
  return true;
}

/**
 * The active world-rule set and its pure evaluators. A container singleton;
 * `setActive(ids)` resolves the world's rules from the registry, and every
 * evaluator folds them into a single multiplier/delta. No side effects — the
 * callers apply the results.
 */
export default class WorldRuleEngine {
  private registry: WorldRuleRegistry;
  private active: WorldRuleDef[] = [];

  constructor() {
    this.registry = inject(WorldRuleRegistry);
  }

  /** Resolve and activate a world's rule ids (unknown ids are warned + skipped). */
  public setActive(ids: readonly string[]): void {
    this.active = [];
    for (const id of ids) {
      const def = this.registry.has(id) ? this.registry.get(id) : undefined;
      if (def) this.active.push(def);
      else console.warn(`[world-rule] 未知规则 "${id}"`);
    }
  }

  /** Directly set the active rules (tests). */
  public setActiveDefs(defs: WorldRuleDef[]): void {
    this.active = [...defs];
  }

  public clear(): void {
    this.active = [];
  }

  public get activeIds(): string[] {
    return this.active.map((r) => r.id);
  }

  public startPatch(): WorldStartResult {
    const stat: StatDelta = {};
    let money = 0;
    const flags: string[] = [];
    const pressureSeed: Record<string, number> = {};
    for (const r of this.active) {
      const s = r.onWorldStart;
      if (!s) continue;
      if (s.stat) addDelta(stat, s.stat);
      if (s.money) money += s.money;
      if (s.flags) flags.push(...s.flags);
      if (s.pressureSeed) {
        for (const [k, v] of Object.entries(s.pressureSeed)) {
          pressureSeed[k] = (pressureSeed[k] ?? 0) + v;
        }
      }
    }
    return { stat, money, flags, pressureSeed };
  }

  public drift(): StatDelta {
    const out: StatDelta = {};
    for (const r of this.active) if (r.statDrift) addDelta(out, r.statDrift);
    return out;
  }

  public eventFactor(
    tags: ReadonlySet<string>,
    id: string,
    category: string | null | undefined,
  ): number {
    let f = 1;
    for (const r of this.active) {
      for (const e of r.eventWeight ?? []) {
        if (matchEvent(e.match, tags, id, category)) f *= e.factor;
      }
    }
    return f;
  }

  public npcSchemeFactor(role: string | undefined, tags: ReadonlySet<string>): number {
    let f = 1;
    for (const r of this.active) {
      for (const e of r.npcSchemeFrequency ?? []) {
        if (matchNpc(e.match, role, tags)) f *= e.factor;
      }
    }
    return f;
  }

  public economyBias(): WorldEconomyBiasResult {
    let inflationBias = 0;
    let marketBias = 0;
    let wageMul = 1;
    for (const r of this.active) {
      const e = r.economy;
      if (!e) continue;
      inflationBias += e.inflationBias ?? 0;
      marketBias += e.marketBias ?? 0;
      wageMul *= e.wageMul ?? 1;
    }
    return { inflationBias, marketBias, wageMul };
  }

  public mortalityHazardMul(): number {
    let f = 1;
    for (const r of this.active) f *= r.mortality?.hazardMul ?? 1;
    return f;
  }

  public weatherMultipliers(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of this.active) {
      for (const [k, v] of Object.entries(r.weatherBias ?? {})) {
        out[k] = (out[k] ?? 1) * v;
      }
    }
    return out;
  }
}
