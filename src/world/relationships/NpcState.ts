import type { StatDelta } from "../stats.js";
import type { KarmaDelta } from "../chronicle/karma.js";

/**
 * Pure NPC state/data types, extracted from {@link NpcSimulation} so the base
 * {@link Npc} class, the scheme layer and the simulator can all share them
 * without import cycles. No behaviour lives here.
 */

export type NpcStage = "child" | "youth" | "adult" | "elder";
export type NpcGoal = "love" | "career" | "wealth" | "health" | "family";
export type EdgeKind = "kin" | "friend" | "rival" | "partner" | "colleague";

export type NpcEventKind =
  | "married"
  | "child"
  | "promote"
  | "illness"
  | "recovered"
  | "moved"
  | "returned"
  | "died"
  | "friendMade"
  | "rivalMade"
  | "windfall"
  | "ruin"
  /** A behaviour-driven scheme (peer vs peer, or NPC → player). */
  | "scheme";

/** Personality axes in [-1, 1]. Derived from role/type unless the def overrides. */
export interface NpcTraits {
  warmth: number;
  ambition: number;
  stability: number;
  sociability: number;
}

/**
 * A scheme's impact on the *player* — applied only when the acting NPC is known
 * to the player at the current age. Lets NPC behaviour drive real consequences
 * (stat swings, buffs, karma, bond shifts) without the actor living in the UI.
 */
export interface NpcPlayerImpact {
  effects?: StatDelta;
  karma?: KarmaDelta;
  buff?: { id: string; turns?: number };
  items?: string[];
  flags?: string[];
  /** Bond change applied to the acting NPC's player↔NPC bond. */
  bond?: Partial<NpcBond>;
  /** Toast i18n key (defaults to nothing when absent). */
  toastKey?: string;
}

export interface NpcSimEvent {
  npcId: string;
  kind: NpcEventKind;
  /** A tie change may carry the other party. */
  otherId?: string;
  /** Narration i18n key (schemes, and any event that wants custom text). */
  logKey?: string;
  toastKey?: string;
  /** Impact on the player, applied by RelationshipSystem for known NPCs. */
  player?: NpcPlayerImpact;
}

export interface NpcLife {
  age: number;
  stage: NpcStage;
  alive: boolean;
  health: number; // 0..100
  wealth: number; // 0..100
  mood: number; // 0..100
  careerTier: number; // 0..4
  partnerId: string | null;
  children: number;
  moved: boolean;
  homeRegion: string | null;
  goals: NpcGoal[];
  /** Free-form behaviour flags a scheme may set (e.g. "scheming", "addicted"). */
  flags: string[];
}

export interface NpcEdge {
  kind: EdgeKind;
  affinity: number; // -100..100
  trust: number; // 0..100
}

/** Multi-axis player↔NPC bond, alongside the scalar affinity on the player. */
export interface NpcBond {
  trust: number; // 0..100
  /** Owed/owing — positive means the player is in the NPC's debt. */
  debt: number; // -100..100
  conflict: number; // 0..100
}

/** Serializable form used for save/restore (goals as plain strings). */
export interface NpcSimSnapshot {
  lives: Record<string, Omit<NpcLife, "goals"> & { goals: string[] }>;
  edges: Record<string, NpcEdge>;
  bonds: Record<string, NpcBond>;
}
