/**
 * Turning a model's answer into an event the engine will accept.
 *
 * The division of labour is deliberate: **the model supplies prose and a
 * bounded stat effect, and nothing structural at all.** It does not choose the
 * id, the event class, the age range, the weight ceiling or the tags. That is
 * not caution for its own sake — the event engine fails *silently* on bad
 * structure. `modEventSchema` does not check `rangeKey`'s format, `EventCenter.add`
 * throws on a malformed one, and `WorldEventLoader.registerEvent` swallows that
 * throw — so a model-authored range would produce an event that is registered,
 * logged, and then never once eligible.
 */

import { StatKey, type StatDelta } from "../stats.js";
import { modEventSchema, type ModEventDef } from "../../types/EventJsonType.js";

/**
 * Stats an invented event may move.
 *
 * A whitelist, not a clamp on everything. `age`, `height`, `weight` and `money`
 * are not gauges — `stats.ts` floors them at zero and caps them nowhere — so a
 * model free to move them is a model free to write an unbounded life.
 */
export const SAFE_EFFECT_KEYS: readonly StatKey[] = [
  "health",
  "intelligence",
  "social",
  "fitness",
  "happiness",
  "reputation",
  "appearance",
  "angerValue",
  "excitationValue",
  "depressionValue",
  "weakValue",
];

/** Most any single stat may move. */
export const MAX_EFFECT_PER_STAT = 10;
/** Most an invented event may move in total, across every stat. */
export const MAX_EFFECT_TOTAL = 25;
/** Most an invented event may weigh in the yearly draw (the game's own top out at 1). */
export const MAX_WEIGHT = 0.6;

export const MAX_TITLE = 40;
export const MAX_BODY = 500;

export interface GeneratedEvent {
  title: string;
  body: string;
  effects: StatDelta;
  weight: number;
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/, "")
    .trim()
    .slice(0, max);
}

function readObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Bring an effect inside the rules.
 *
 * Over-budget effects are scaled down rather than trimmed, so the *shape* of
 * what the model intended survives: an event meant to cost a little health and
 * a lot of happiness still does, just less of both.
 */
export function clampEffects(raw: unknown): StatDelta {
  const out: StatDelta = {};
  if (typeof raw !== "object" || raw === null) return out;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!SAFE_EFFECT_KEYS.includes(key as StatKey)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const clamped = Math.max(-MAX_EFFECT_PER_STAT, Math.min(MAX_EFFECT_PER_STAT, value));
    const rounded = Math.round(clamped * 100) / 100;
    if (rounded !== 0) out[key as StatKey] = rounded;
  }

  const total = Object.values(out).reduce((sum, v) => sum + Math.abs(v ?? 0), 0);
  if (total > MAX_EFFECT_TOTAL) {
    const scale = MAX_EFFECT_TOTAL / total;
    for (const key of Object.keys(out) as StatKey[]) {
      out[key] = Math.round((out[key] ?? 0) * scale * 100) / 100;
    }
  }
  return out;
}

/** Read an event out of the model's answer, or `null` if there is nothing usable. */
export function parseGeneratedEvent(raw: string): GeneratedEvent | null {
  const obj = readObject(raw);
  if (!obj) return null;

  const title = clean(obj.title, MAX_TITLE);
  const body = clean(obj.body, MAX_BODY);
  const effects = clampEffects(obj.effects);
  // An event with no words, or with no effect at all, is not worth a slot in
  // the pool.
  if (!title || !body || Object.keys(effects).length === 0) return null;

  const rawWeight = typeof obj.weight === "number" ? obj.weight : 0.4;
  return {
    title,
    body,
    effects,
    weight: Math.max(0.05, Math.min(MAX_WEIGHT, rawWeight)),
  };
}

/**
 * The age band an invented event may fire in.
 *
 * Always well-formed, because it is built rather than parsed: `start < end`,
 * both integers, and never past the game's own ceiling.
 */
export function ageRange(age: number): string {
  const start = Math.max(0, Math.min(98, Math.floor(age)));
  return `${start}-${Math.min(100, Math.max(start + 1, start + 10))}`;
}

/** A stable id, so the same event re-registers under the same name. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function generatedEventId(ev: GeneratedEvent): string {
  return `ai_ev_${hash(`${ev.title}:${ev.body}`).toString(36)}`;
}

/**
 * The definition the loader takes.
 *
 * Built as a plain object and put through the *same* `modEventSchema` the
 * loader uses, so a definition that would not survive loading cannot be created
 * in the first place. `nameKey` and `textKey` hold the model's literal text —
 * translation falls back to the key on a miss, so it renders verbatim.
 *
 * `once: true` and a dedicated `category` keep invented events from repeating
 * or crowding out the authored ones; `EffectEvent` is pinned because it applies
 * a declarative payload and therefore needs no code, unlike a `ChoiceEvent`,
 * which would drag the modal/pending-choice save machinery in with it.
 */
export function toEventDef(ev: GeneratedEvent, age: number): ModEventDef | null {
  const parsed = modEventSchema.safeParse({
    type: "EffectEvent",
    id: generatedEventId(ev),
    nameKey: ev.title,
    textKey: ev.body,
    rangeKey: [ageRange(age)],
    weight: ev.weight,
    once: true,
    category: "ai",
    params: { effects: ev.effects },
  });
  return parsed.success ? parsed.data : null;
}
