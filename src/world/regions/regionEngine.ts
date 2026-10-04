/**
 * Pure region simulation: each region has prosperity, population, stability and
 * development; neighbours trade, migrants drift toward opportunity, and
 * regions boom, decline or fall into turmoil. No container, no React —
 * `RegionsSystem` is a thin shell over it.
 */

export interface RegionSim {
  id: string;
  prosperity: number; // 0..100
  population: number; // 0..100 (relative density)
  stability: number; // 0..100
  development: number; // 0..100
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

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

export function emptyRegions(
  defs: Array<{ id: string }>,
  startId: string,
): RegionsState {
  const state: RegionsState = { regions: {}, currentId: startId, visits: {} };
  for (const d of defs) {
    state.regions[d.id] = { id: d.id, prosperity: 50, population: 50, stability: 50, development: 30 };
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

/** One year of regional drift, trade between neighbours, and local flashpoints. */
export function tickRegions(
  state: RegionsState,
  adjacency: RegionAdjacency,
  rng: Rng,
): RegionEvent[] {
  const events: RegionEvent[] = [];

  for (const sim of Object.values(state.regions)) {
    const neighbors = neighborsOf(adjacency, sim.id)
      .map((id) => state.regions[id])
      .filter((r): r is RegionSim => !!r);
    const avgNeighborProsperity = neighbors.length
      ? neighbors.reduce((s, r) => s + r.prosperity, 0) / neighbors.length
      : sim.prosperity;

    // Trade pulls prosperity toward neighbours; development compounds it.
    sim.prosperity = clamp(
      sim.prosperity +
        (rng() - 0.5) * 6 +
        (avgNeighborProsperity - sim.prosperity) * 0.1 +
        sim.development * 0.02,
    );
    sim.development = clamp(
      sim.development + (rng() - 0.5) * 1.5 + (sim.prosperity > 60 ? 0.4 : -0.2),
    );
    sim.stability = clamp(
      sim.stability + (sim.prosperity - 50) * 0.08 + (rng() - 0.5) * 3,
    );
    // Population migrates toward prosperity + stability.
    sim.population = clamp(
      sim.population + (sim.prosperity - 50) * 0.05 + (sim.stability - 50) * 0.03,
    );

    if (sim.prosperity >= 80 && rng() < 0.15) events.push({ kind: "region.boom", params: { id: sim.id } });
    else if (sim.prosperity <= 20 && rng() < 0.15) events.push({ kind: "region.bust", params: { id: sim.id } });
    if (sim.stability <= 25 && rng() < 0.2) events.push({ kind: "region.turmoil", params: { id: sim.id } });
  }

  return events;
}

/** Move the player to `targetId` (assumes adjacency was checked). Applies the
 *  region's tone: prosperity nudges mood, and the region leans on a faction. */
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
