import { KarmaState } from "../chronicle/karma.js";
import { Season } from "../weather/WeatherDefinition.js";

/** Coarse emotional colour drawn from the player's state. */
export type MoodKey =
  | "hopeful"
  | "content"
  | "weary"
  | "angry"
  | "sorrowful"
  | "sick"
  | "neutral";

export interface NarrativePressure {
  /** e.g. `pr_unrest` */
  id: string;
  /** pressure class, e.g. `society` */
  cls: string;
  value: number;
}

export interface NarrativeState {
  year: number;
  eraId: string;
  regionId: string;
  weatherId: string;
  season: Season;
  karma: KarmaState;
  pressures: NarrativePressure[];
  mood: MoodKey;
  /** Already-localized recall material the narrator may reference. */
  memory?: NarrativeMemory;
}

/**
 * What the narrator remembers: recent happenings, the player's closest tie and
 * calling, and an active through-line. Strings are pre-localized by the caller
 * (the composer stays pure).
 */
export interface NarrativeMemory {
  recentEvents: string[];
  topNpc?: string;
  topNpcAffinity?: number;
  career?: string;
  careerRank?: number;
  arc?: string;
}

export interface NarrativeSegment {
  key: string;
  params?: Record<string, string | number>;
}

/** Deterministic PRNG so a given (year, weather, era) always reads the same. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(seed: number, n: number): number {
  const r = mulberry32(seed)();
  return Math.min(n - 1, Math.floor(r * n));
}

/** Derive the mood key from the player's vitals + active effects. */
export function deriveMood(input: {
  health: number;
  happiness: number;
  effectIds: string[];
}): MoodKey {
  if (input.health < 30) return "sick";
  if (input.effectIds.includes("fx_sick")) return "sick";
  if (input.effectIds.includes("fx_rage")) return "angry";
  if (input.effectIds.includes("fx_gloom")) return "sorrowful";
  if (input.effectIds.includes("fx_fatigue")) return "weary";
  if (input.happiness >= 75) return "content";
  if (input.happiness >= 55) return "hopeful";
  if (input.happiness < 35) return "sorrowful";
  return "neutral";
}

/** The single most out-of-balance pressure axis (furthest from 50). */
export function strongestPressure(
  pressures: NarrativePressure[],
): NarrativePressure | undefined {
  let best: NarrativePressure | undefined;
  for (const p of pressures) {
    if (!best || Math.abs(p.value - 50) > Math.abs(best.value - 50)) best = p;
  }
  return best;
}

/**
 * Compose a one-paragraph scene from the living world: weather + season,
 * era, region, the strongest hidden-score swing, the player's mood, and a
 * closing beat. Returns translation segments (resolve with `t`).
 */
export function buildNarrative(state: NarrativeState): NarrativeSegment[] {
  const seed =
    (state.year * 2654435761) ^
    hash(state.weatherId) ^
    hash(state.eraId) ^
    hash(state.regionId);

  const segments: NarrativeSegment[] = [
    { key: `narr.scene.${state.weatherId}` },
  ];
  if (state.eraId) segments.push({ key: `narr.era.${state.eraId}` });
  if (state.regionId) segments.push({ key: `narr.region.${state.regionId}` });

  const pressure = strongestPressure(state.pressures);
  if (pressure) {
    const dir = pressure.value >= 50 ? "hi" : "lo";
    segments.push({ key: `narr.pressure.${pressure.cls}.${dir}` });
  }

  segments.push({ key: `narr.mood.${state.mood}` });

  // One remembered detail — recent event, a bond, a calling, or a through-line.
  const recalls: NarrativeSegment[] = [];
  const m = state.memory;
  if (m) {
    if (m.recentEvents.length > 0) {
      recalls.push({ key: "narr.recall.event", params: { event: m.recentEvents[0] } });
    }
    if (m.topNpc) {
      recalls.push({
        key: "narr.recall.bond",
        params: { npc: m.topNpc, value: m.topNpcAffinity ?? 0 },
      });
    }
    if (m.career) {
      recalls.push({
        key: "narr.recall.career",
        params: { career: m.career, rank: m.careerRank ?? 1 },
      });
    }
    if (m.arc) {
      recalls.push({ key: "narr.recall.arc", params: { arc: m.arc } });
    }
  }
  if (recalls.length > 0) {
    segments.push(recalls[pick(seed ^ 0x51ed270b, recalls.length)]);
  }

  segments.push({ key: `narr.close.${pick(seed ^ 0x9e3779b9, 3)}` });
  return segments;
}
