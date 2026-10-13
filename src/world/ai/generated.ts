/**
 * Turning a model's answer into something the simulation will accept.
 *
 * Everything an invented character is, passes through here first. The model
 * writes prose and picks a personality; it does not get to pick what the game
 * is able to simulate. Three things are enforced:
 *
 * - **Known roles only.** `RelationshipContent` returns no interactions and no
 *   autonomy for an unrecognised `roleKey`, so such an NPC would be a name with
 *   no behaviour — decoration standing in the relationships list.
 * - **Bounded traits.** The four axes drive the whole NPC simulation; a model
 *   that answers `warmth: 900` would make a character that never stops.
 * - **Bounded text.** Names and descriptions are rendered into fixed-width
 *   panels, and the literal-fallback translation layer (see `translate.ts`)
 *   means whatever is written here is shown verbatim.
 */

import type { NpcDefinition } from "../relationships/NpcDefinition.js";
import type { NpcTraits } from "../relationships/NpcState.js";
import { ROLE_TO_TYPE } from "../relationships/NpcRoles.js";

/** The roles an invented character may hold — every one the game simulates. */
export const GENERATED_ROLES: readonly string[] = Object.keys(ROLE_TO_TYPE);

/** Upper bounds the model cannot argue its way past. */
export const MAX_NAME = 24;
export const MAX_DESCRIPTION = 140;
export const MAX_TEMPERAMENT = 40;
export const MAX_OPENING = 400;

/** Affinity an invented stranger starts at: met, but not close. */
export const STRANGER_AFFINITY = 12;

export interface GeneratedNpc {
  name: string;
  roleKey: string;
  description: string;
  temperament: string;
  traits: NpcTraits;
  /** The first thing they say — the body of their opening letter. */
  opening: string;
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/, "")
    .trim()
    .slice(0, max);
}

/** The JSON object inside a model answer, prose and code fences included. */
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

/** A trait axis, clamped into the range the simulation assumes. */
function axis(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(-1, Math.min(1, value));
}

/** Neutral-ish defaults, so a model that omits the profile still gets a person. */
function traitsOf(obj: Record<string, unknown>): NpcTraits {
  const src = (obj.traits ?? {}) as Record<string, unknown>;
  return {
    warmth: axis(src.warmth, 0.3),
    ambition: axis(src.ambition, 0.4),
    stability: axis(src.stability, 0.6),
    sociability: axis(src.sociability, 0.5),
  };
}

/**
 * Read a character out of the model's answer, or `null` if it is not usable.
 *
 * `null` is a normal outcome, not an error: a model that invents an unknown
 * role, or names nobody, has produced something the game cannot simulate, and
 * the caller simply generates nothing rather than registering a ghost.
 */
export function parseGeneratedNpc(raw: string): GeneratedNpc | null {
  const obj = readObject(raw);
  if (!obj) return null;

  const name = clean(obj.name, MAX_NAME);
  if (!name) return null;

  const roleKey = clean(obj.roleKey, 60);
  if (!GENERATED_ROLES.includes(roleKey)) return null;

  return {
    name,
    roleKey,
    description: clean(obj.description, MAX_DESCRIPTION),
    temperament: clean(obj.temperament, MAX_TEMPERAMENT),
    traits: traitsOf(obj),
    opening: clean(obj.opening, MAX_OPENING),
  };
}

/** A stable 32-bit hash, so the same character keeps the same id. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The id an invented character is registered under.
 *
 * Derived from their name and role rather than a counter, so a reload that
 * regenerates the same person lands on the same id instead of creating a twin.
 */
export function generatedNpcId(npc: GeneratedNpc): string {
  return `ai_npc_${hash(`${npc.roleKey}:${npc.name}`).toString(36)}`;
}

/**
 * The definition the registry takes.
 *
 * Note what is *not* here: `labelKey` and `descKey` hold the model's literal
 * text. `resolveTranslation` falls back to the key itself when a lookup misses,
 * so literal text renders verbatim and no runtime translation table is needed.
 * These fields are never called with params, so braces in the text are safe.
 */
export function toNpcDefinition(
  npc: GeneratedNpc,
  playerAge: number,
): NpcDefinition {
  return {
    id: generatedNpcId(npc),
    labelKey: npc.name,
    descKey: npc.description || npc.name,
    type: ROLE_TO_TYPE[npc.roleKey],
    roleKey: npc.roleKey,
    initial: STRANGER_AFFINITY,
    temperamentKey: npc.temperament || undefined,
    // They enter the life now, whatever the role's usual window says — the
    // encounter is the point, and the window would have shut them out.
    knownFromAge: Math.floor(playerAge),
    params: { traits: npc.traits },
  };
}
