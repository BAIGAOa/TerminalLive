/**
 * The region layer, as the NPC simulation is allowed to see it.
 *
 * Numbers only, and read-only: the simulator never gets the `RegionsSystem`, so
 * it cannot move a region, and the decision functions below are plain arithmetic
 * that can be tested without booting anything.
 *
 * It lives on the region side of the tree on purpose — `NpcScheme.ts` needs these
 * types, and `npcTypes/*` already imports *from* `NpcScheme`, so putting them
 * there would close a cycle.
 */

export interface NpcRegion {
  id: string;
  prosperity: number;
  stability: number;
  population: number;
}

/** What a region is like from the inside, for people who live in it. */
export interface NpcRegionView {
  /** The region the player lives in — where a newcomer is assumed to be from. */
  readonly currentId: string;
  /** A region by id, or `undefined` — including when the id is not one of ours. */
  of(regionId: string | null | undefined): NpcRegion | undefined;
  /** The most prosperous neighbour of `regionId`, if it has any. */
  bestNeighbor(regionId: string): NpcRegion | undefined;
}

export type RegionDisposition = "boom" | "calm" | "bust";

/** At or above this, a region draws people in. */
export const BOOM_AT = 65;
/** At or below this, people start looking for a way out. */
export const BUST_AT = 30;

export function regionDisposition(
  region: NpcRegion | undefined,
): RegionDisposition {
  if (!region) return "calm";
  if (region.prosperity >= BOOM_AT) return "boom";
  if (region.prosperity <= BUST_AT) return "bust";
  return "calm";
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * How hard a region pushes its people out. 0..1.
 *
 * Zero at a merely ordinary prosperity, so a normal region is exactly as
 * sticky as it was before any of this existed.
 */
export function emigrationPressure(region: NpcRegion | undefined): number {
  if (!region) return 0;
  return clamp01((40 - region.prosperity) / 40);
}

/** How much a prosperous region pulls people in. 0..1. */
export function opportunityPull(region: NpcRegion | undefined): number {
  if (!region) return 0;
  return clamp01((region.prosperity - 50) / 40);
}

/** How lawless a region has become — what a predator reads as opportunity. */
export function desperation(region: NpcRegion | undefined): number {
  if (!region) return 0;
  return clamp01((45 - region.stability) / 45);
}

/**
 * Chance multiplier for leaving home.
 *
 * Exactly 1 for a region that is merely getting by, so with no region view (or
 * an ordinary region) an NPC migrates at precisely the rate it always did.
 */
export function migrateMultiplier(home: NpcRegion | undefined): number {
  return 1 + 3 * emigrationPressure(home);
}

/** Chance multiplier for coming back — people return to somewhere worth living. */
export function returnMultiplier(home: NpcRegion | undefined): number {
  return 1 + 3 * opportunityPull(home);
}

/** The yearly pull a home region exerts on an NPC's wealth, as a delta. */
export function homeWealthDrift(home: NpcRegion | undefined): number {
  if (!home) return 0;
  return (home.prosperity - 50) / 60;
}

/** The same for mood — and a bad region wears people down more than a good one lifts them. */
export function homeMoodDrift(home: NpcRegion | undefined): number {
  if (!home) return 0;
  return (home.stability - 50) / 50;
}
