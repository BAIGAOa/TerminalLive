import type Player from "../world/Player.js";
import type { Incident } from "../world/Incident.js";
import type WorldState from "../world/chronicle/WorldState.js";
import type PressureState from "../world/pressures/PressureState.js";
import type WeatherState from "../world/weather/WeatherState.js";

/** The live state a director rule may read. */
export interface DirectorContext {
  player: Player;
  world: WorldState | null;
  pressures: PressureState | null;
  weather: WeatherState | null;
}

/**
 * A weight multiplier for a candidate, given its tags and the live state.
 * Mods register these via `ctx.addWeightRule`.
 */
export type WeightRule = (
  incident: Incident,
  tags: ReadonlySet<string>,
  ctx: DirectorContext,
) => number;

interface RegisteredRule {
  id: string;
  factor: WeightRule;
}

/** Strengths of the built-in stat-driven pushes. */
const MERCY_BOOST = 2.5;
const WEALTH_BOOST = 1.8;
const STREAK_BOOST = 1.6;
const STREAK_DAMP = 0.7;

/**
 * The "narrative director": nudges event weights using the player's live state
 * and a short luck-streak memory, so a life reads as *paced* rather than purely
 * probabilistic. Low HP surfaces recovery events; a long run of good fortune
 * invites a challenge; a bad run earns a mercy beat.
 *
 * A container singleton — one director per life, reset via {@link reset}.
 */
export default class EventDirector {
  /** EWMA of recent event tone in [-1, 1]: +1 all boons, -1 all challenges. */
  private fortune = 0;
  private rules: RegisteredRule[] = [];
  private tagCache = new Map<string, ReadonlySet<string>>();

  constructor() {
    this.rules = builtinRules();
    // The streak rule reads this director's own `fortune`, so it is installed
    // here (a plain closure) rather than in the standalone rule list.
    this.addRule("streak", (_incident, tags) => {
      const f = this.fortune;
      if (f > 0.5 && tags.has("challenge")) return STREAK_BOOST;
      if (f > 0.5 && tags.has("boon")) return STREAK_DAMP;
      if (f < -0.5 && (tags.has("boon") || tags.has("heal"))) return STREAK_BOOST;
      if (f < -0.5 && tags.has("challenge")) return STREAK_DAMP;
      return 1;
    });
  }

  public reset(): void {
    this.fortune = 0;
    this.tagCache.clear();
  }

  /** Serializable streak state (rides along in the save). */
  public snapshot(): { fortune: number } {
    return { fortune: this.fortune };
  }

  public restore(snap: { fortune?: number }): void {
    this.fortune = snap.fortune ?? 0;
  }

  /** Current luck-streak score (for debug / console). */
  public get fortuneScore(): number {
    return this.fortune;
  }

  /** A candidate's tags: explicit `incident.tags` ∪ tags inferred from its shape. */
  public tagsOf(incident: Incident): ReadonlySet<string> {
    let tags = this.tagCache.get(incident.id);
    if (!tags) {
      tags = inferTags(incident);
      this.tagCache.set(incident.id, tags);
    }
    return tags;
  }

  /** Product of every rule's factor for a candidate. */
  public factor(incident: Incident, ctx: DirectorContext): number {
    const tags = this.tagsOf(incident);
    let f = 1;
    for (const rule of this.rules) {
      const v = rule.factor(incident, tags, ctx);
      if (Number.isFinite(v) && v > 0) f *= v;
    }
    return f;
  }

  /** Register an extra rule (mods). Returns a disposer. */
  public addRule(id: string, factor: WeightRule): () => void {
    const entry = { id, factor };
    this.rules.push(entry);
    // Remove by IDENTITY, not by id — a mod reusing a builtin rule id (e.g.
    // "mercy") must not delete the builtin on unload.
    return () => {
      const i = this.rules.indexOf(entry);
      if (i >= 0) this.rules.splice(i, 1);
    };
  }

  public get ruleIds(): string[] {
    return this.rules.map((r) => r.id);
  }

  /** Fold a fired event's tone into the streak memory. */
  public observe(incident: Incident): void {
    const tags = this.tagsOf(incident);
    let tone = 0;
    if (tags.has("boon") || tags.has("heal") || tags.has("comfort")) tone += 1;
    if (tags.has("challenge") || tags.has("loss")) tone -= 1;
    this.fortune = this.fortune * 0.6 + tone * 0.4;
  }
}

/** Tags inferred purely from an event's declared tags and choice effects. */
export function inferTags(incident: Incident): ReadonlySet<string> {
  const tags = new Set<string>(incident.tags);
  if (incident.category) tags.add(incident.category);
  for (const choice of incident.choices ?? []) {
    const e = choice.effects ?? {};
    const health = e.health ?? 0;
    const money = e.money ?? 0;
    const happiness = e.happiness ?? 0;
    if (health > 0) tags.add("heal");
    if (happiness > 0 && health >= 0) tags.add("comfort");
    if (money > 0) tags.add("gain");
    if (money < 0) tags.add("loss");
    if (health < 0 || happiness < 0) tags.add("challenge");
    if ((e.angerValue ?? 0) > 0 || (e.depressionValue ?? 0) > 0) tags.add("stress");
  }
  return tags;
}

function builtinRules(): RegisteredRule[] {
  return [
    {
      // Mercy: when the player is hurt, recovery events surface.
      id: "mercy",
      factor: (_incident, tags, ctx) => {
        const health = ctx.player.health;
        if (health >= 50) return 1;
        const wounded =
          tags.has("heal") || tags.has("rest") || tags.has("comfort");
        if (!wounded) return 1;
        return health < 35 ? MERCY_BOOST : 1 + (MERCY_BOOST - 1) * 0.4;
      },
    },
    {
      // Wealth: being rich attracts money events (invest/scam/charity/luxury).
      id: "wealth",
      factor: (_incident, tags, ctx) => {
        const money = ctx.player.money;
        if (money >= 5000) {
          if (
            tags.has("invest") ||
            tags.has("scam") ||
            tags.has("charity") ||
            tags.has("luxury")
          ) {
            return WEALTH_BOOST;
          }
          return 1;
        }
        if (money <= 0 && (tags.has("work") || tags.has("gain"))) return 1.4;
        return 1;
      },
    },
  ];
}
