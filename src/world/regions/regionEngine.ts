/**
 * Pure region simulation: each region has prosperity, population, stability and
 * development; neighbours trade, migrants drift toward opportunity, and regions
 * boom, decline, and sometimes fall into a ruin they take decades to leave.
 *
 * No container, no React — `RegionsSystem` is a thin shell over it.
 *
 * ## Why the model looks like this
 *
 * It used to be four lines of drift, and one of them
 * (`+ development * 0.02`) was positive with nothing to offset it. Measured, the
 * whole map sat at exactly 100.000 by year 47 and every region was identical by
 * year 63 — so `region.bust` and `region.turmoil` could never fire, and a player
 * living 85 years never saw a place change.
 *
 * What replaces it is a carrying capacity per region: prosperity is pulled
 * toward it, so it can be *above* capacity (and fall) as easily as below. On top
 * of that sit two things the old model had no room for — random shocks, which
 * are what can knock a healthy region down at all, and a collapse regime with
 * hysteresis, which is what keeps it down.
 */

export interface RegionSim {
  id: string;
  prosperity: number; // 0..100
  population: number; // 0..100 (relative density)
  stability: number; // 0..100
  development: number; // 0..100
  /**
   * Whether the region is in the ruined state.
   *
   * Optional: a save from before this existed loads fine, and `false` is the
   * only correct reading of "the field is absent".
   */
  collapsed?: boolean;
}

export interface RegionsState {
  regions: Record<string, RegionSim>;
  /** The region the player currently lives in. */
  currentId: string;
  /** Times the player has lived in each region. */
  visits: Record<string, number>;
}

export interface RegionEvent {
  kind: string;
  params?: Record<string, number | string>;
}

export type RegionAdjacency = Record<string, string[]>;
export type Rng = () => number;

/** Below this a region reads as ruined to the player, whatever the flag says. */
export const DESOLATE = 15;

/** How hard prosperity is pulled toward the carrying capacity, per year. */
const GROWTH = 0.05;
/** Neighbour trade pulls toward parity — weak, so it cannot flatten the map. */
const TRADE_PULL = 0.05;
/** Yearly loss while collapsed. Steep, because ruins do not sit still. */
const COLLAPSE_DECAY = 2.5;
const RECOVER_GAP = 8;
const RECOVER_UP = 12;
const RECOVER_CHANCE = 0.02;
/** A shock takes this fraction of current prosperity (15%..40%). */
const SHOCK_MIN = 0.15;
const SHOCK_SPAN = 0.25;
const SHOCK_CHANCE_LO = 2;
const SHOCK_CHANCE_SPAN = 4;

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

/** FNV-1a, matching `NpcSimulation.hashId` so both derive character alike. */
function hashId(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * A region's fixed character.
 *
 * Derived from the id rather than drawn from the RNG, for the same reason
 * `NpcSimulation.idJitter` is: an extra draw would shift every later roll and
 * break the seeded replay the dev harnesses depend on. Each field is salted
 * separately, so carrying capacity and tipping point are not correlated and two
 * neighbouring ids (`reg_x_1`, `reg_x_2`) cannot collide.
 */
export interface RegionCharacter {
  /** Prosperity this region reverts to when nothing is wrong. 34..80. */
  carryingCapacity: number;
  /** Below this it tips into collapse — the point of no return. */
  allee: number;
  /** How fast it returns to capacity. */
  growthRate: number;
  /** Amplitude of the ordinary year-to-year swing. */
  volatility: number;
  /** Yearly chance of a shock big enough to threaten a healthy region. */
  shockChance: number;
}

export function regionCharacter(
  id: string,
  over: Partial<RegionCharacter> = {},
): RegionCharacter {
  const salted = (salt: string) => hashId(`${id}#${salt}`);
  const carryingCapacity = 34 + (salted("k") % 47); // 34..80
  return {
    carryingCapacity,
    // 35%..56% of capacity. Never below 12, so a region always has to be pushed
    // down rather than simply born dead.
    allee: Math.round(carryingCapacity * (0.35 + (salted("a") % 21) / 100)),
    growthRate: GROWTH,
    volatility: (100 + (salted("v") % 80)) / 100, // 1.00..1.79
    shockChance: (SHOCK_CHANCE_LO + (salted("s") % SHOCK_CHANCE_SPAN)) / 100,
    ...over,
  };
}

/**
 * Seed every region from its own character.
 *
 * Seeding them all at 50 was half of why the map converged: identical inputs
 * under a symmetric rule stay identical however long you run them. Deterministic
 * — no RNG — so a life is reproducible from its seed alone.
 */
export function emptyRegions(
  defs: Array<{ id: string; character?: Partial<RegionCharacter> }>,
  startId: string,
): RegionsState {
  const state: RegionsState = { regions: {}, currentId: startId, visits: {} };
  for (const d of defs) {
    const c = regionCharacter(d.id, d.character);
    const jitter = (hashId(`${d.id}#j`) % 21) - 10; // -10..10
    state.regions[d.id] = {
      id: d.id,
      prosperity: clamp(c.carryingCapacity + jitter, 10, 90),
      population: clamp(Math.round(30 + c.carryingCapacity * 0.4)),
      stability: clamp(Math.round(c.carryingCapacity * 0.6 + 20)),
      development: clamp(Math.round(c.carryingCapacity * 0.5)),
      collapsed: false,
    };
  }
  state.visits[startId] = 1;
  return state;
}

export function neighborsOf(adjacency: RegionAdjacency, id: string): string[] {
  return adjacency[id] ?? [];
}

export function canMove(
  state: RegionsState,
  targetId: string,
  adjacency: RegionAdjacency,
): boolean {
  if (!state.regions[targetId]) return false;
  return neighborsOf(adjacency, state.currentId).includes(targetId);
}

export function prosperityTier(sim: RegionSim): string {
  if (sim.prosperity >= 70) return "region.tier.thriving";
  if (sim.prosperity >= 45) return "region.tier.stable";
  if (sim.prosperity >= 25) return "region.tier.strained";
  return "region.tier.declining";
}

export interface TickOptions {
  /** Resolve a region's character, so a world's `regions.json` can override it. */
  characterOf?: (id: string) => RegionCharacter;
  /**
   * The player's weight on one region, in points of carrying capacity.
   *
   * Applied to the *target* rather than as a yearly bonus on purpose: a raw
   * yearly bonus against a restoring force this strong would move the
   * equilibrium by tens of points and make the player omnipotent. Shifting the
   * capacity by N points moves the region's long-run level by exactly N.
   */
  influence?: { regionId: string; amount: number };
}

/**
 * One year of regional economy, trade between neighbours, and local shocks.
 *
 * Mutates `state` in place (the engine's existing style); returns the events
 * worth telling the player about.
 */
export function tickRegions(
  state: RegionsState,
  adjacency: RegionAdjacency,
  rng: Rng,
  opts: TickOptions = {},
): RegionEvent[] {
  const events: RegionEvent[] = [];
  const charOf = opts.characterOf ?? ((id: string) => regionCharacter(id));

  // Snapshot prosperity first: trade must read the PRE-tick prosperity of every
  // neighbour, not a mix of pre/post values depending on map iteration order.
  const preProsperity: Record<string, number> = {};
  for (const sim of Object.values(state.regions)) {
    preProsperity[sim.id] = sim.prosperity;
  }

  for (const sim of Object.values(state.regions)) {
    const c = charOf(sim.id);
    const influence =
      opts.influence?.regionId === sim.id ? opts.influence.amount : 0;
    const capacity = clamp(c.carryingCapacity + influence, 5, 100);
    // Recovery needs MORE than the tipping point that caused the fall — that
    // gap is the hysteresis, and it is why a lost region stays lost.
    const recover = Math.min(capacity - RECOVER_GAP, c.allee + RECOVER_UP);

    const neighborIds = neighborsOf(adjacency, sim.id).filter(
      (id) => state.regions[id] !== undefined,
    );
    const avgNeighborProsperity = neighborIds.length
      ? neighborIds.reduce((s, id) => s + preProsperity[id], 0) /
        neighborIds.length
      : preProsperity[sim.id];

    const wasCollapsed = sim.collapsed === true;
    let p = sim.prosperity;

    if (!wasCollapsed) {
      p +=
        c.growthRate * (capacity - p) +
        (avgNeighborProsperity - p) * TRADE_PULL +
        (rng() - 0.5) * 2 * c.volatility;

      // The only thing that can knock a healthy region down. Without it a region
      // simply reverts to its capacity forever and nothing ever happens.
      if (rng() < c.shockChance) {
        p -= (SHOCK_MIN + rng() * SHOCK_SPAN) * Math.max(p, 1);
      }
      if (p < c.allee) sim.collapsed = true;
    } else {
      p -= COLLAPSE_DECAY * (1 + (c.allee - p) / 100) + (rng() - 0.5) * 1.5;
      // Rare, and it has to overshoot the capacity to escape — which is what
      // makes recovering slower than falling.
      if (rng() < RECOVER_CHANCE) p += (recover - p) * 0.6 + recover * 0.5;
      if (p >= recover) sim.collapsed = false;
    }
    sim.prosperity = clamp(p);

    sim.stability = clamp(
      sim.stability +
        (sim.prosperity - sim.stability) * 0.06 +
        (sim.collapsed ? -3 : 0) +
        (rng() - 0.5) * 3,
    );
    sim.population = clamp(
      sim.population +
        (sim.prosperity - sim.population) * 0.06 +
        (sim.collapsed ? -1.5 : 0) +
        (rng() - 0.5) * 2,
    );
    sim.development = clamp(
      sim.development +
        (sim.prosperity > capacity * 0.8 ? 0.5 : -0.3) +
        (rng() - 0.5) * 1.5,
    );

    // ── what the player is told ──────────────────────────────────
    // Boom and bust read the PRE-tick value: a region that was thriving when the
    // year began is news even if it slipped a little by the time the year ended.
    if (!wasCollapsed && sim.collapsed) {
      events.push({ kind: "region.collapse", params: { id: sim.id } });
    } else if (wasCollapsed && !sim.collapsed) {
      events.push({ kind: "region.recover", params: { id: sim.id } });
    }
    if (!sim.collapsed) {
      const was = preProsperity[sim.id];
      if (was >= 80 && rng() < 0.15) {
        events.push({ kind: "region.boom", params: { id: sim.id } });
      } else if (was <= 20 && rng() < 0.15) {
        events.push({ kind: "region.bust", params: { id: sim.id } });
      }
    }
    if (sim.stability <= 25 && rng() < 0.2) {
      events.push({ kind: "region.turmoil", params: { id: sim.id } });
    }
  }

  return events;
}

/**
 * Move the player to `targetId` (assumes adjacency was checked). Applies the
 * region's tone: prosperity nudges mood, and the region leans on a faction.
 */
export function moveTo(state: RegionsState, targetId: string): RegionEvent[] {
  const sim = state.regions[targetId];
  if (!sim) return [];
  state.currentId = targetId;
  state.visits[targetId] = (state.visits[targetId] ?? 0) + 1;
  return [{ kind: "region.moved", params: { id: targetId } }];
}

/** Mood shift from the destination region's prosperity (applied by the caller). */
export function regionMoodDelta(sim: RegionSim): number {
  return Math.round((sim.prosperity - 50) / 15);
}

/** The most prosperous region — a natural migration target. */
export function bestRegion(state: RegionsState): RegionSim | null {
  let best: RegionSim | null = null;
  for (const r of Object.values(state.regions)) {
    if (!best || r.prosperity > best.prosperity) best = r;
  }
  return best;
}

/** What a player is worth to the place they live in. */
export interface PlayerStanding {
  money: number;
  reputation: number;
  careerRank: number;
  factionStanding: number;
}

/**
 * The player's weight on their region, in points of carrying capacity.
 *
 * Bounded by construction, and deliberately so: the point is a life that leaves
 * a mark, not one that trivially maxes a map. A nobody is a slight drag; a rich,
 * famous, senior, well-connected resident can lift a region by up to
 * {@link MAX_INFLUENCE} — and no further, however rich they get (wealth
 * saturates, so the tenth million buys as little as the second).
 */
export const MAX_INFLUENCE = 8;
export const MIN_INFLUENCE = -3;

export function playerInfluence(s: PlayerStanding): number {
  const wealth = s.money <= 0 ? 0 : s.money / (s.money + 2000); // 0..1, saturating
  const reputation = clamp(s.reputation, -100, 100) / 100;
  const rank = clamp(s.careerRank, 0, 4) / 4;
  const faction = clamp(s.factionStanding, -100, 100) / 100;
  const score =
    0.35 * wealth + 0.25 * reputation + 0.25 * rank + 0.15 * faction;
  return Math.round(
    clamp((score - 0.2) * 16, MIN_INFLUENCE, MAX_INFLUENCE),
  );
}

/** What living in a region does to a person each year. */
export interface RegionDelta {
  happiness?: number;
  health?: number;
  money?: number;
}

/**
 * The yearly mark a region leaves on its residents.
 *
 * Small on purpose — a region is a tone, not a yoke. Being somewhere thriving is
 * worth a couple of points of mood and a little money; being somewhere ruined
 * costs the same.
 */
export function regionYearlyDelta(sim: RegionSim | undefined): RegionDelta {
  if (!sim) return {};
  const p = (sim.prosperity - 50) / 50;
  const s = (sim.stability - 50) / 50;
  const out: RegionDelta = {};
  const happiness = Math.round(p * 2 + s * 1.5);
  const health = Math.round(p);
  const money = Math.round(p * 45);
  if (happiness !== 0) out.happiness = happiness;
  if (health !== 0) out.health = health;
  if (money !== 0) out.money = money;
  return out;
}
