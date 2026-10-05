import type { RandomSource } from "../../core/random/RandomSource.js";
import type { Npc } from "./Npc.js";
import type {
  NpcBond,
  NpcEdge,
  NpcLife,
  NpcPlayerImpact,
} from "./NpcState.js";

/**
 * The NPC↔NPC / NPC→player behaviour layer. An {@link Npc} subclass returns
 * these results from {@link Npc.peerScheme}; {@link NpcSimulation} is the only
 * thing that *applies* them (clamping lives, writing edges, emitting events), so
 * archetype behaviour stays declarative and pure — easy to unit-test.
 */

/** Additive changes to a single NPC's life (clamped on apply). */
export interface NpcLifeDelta {
  health?: number;
  wealth?: number;
  mood?: number;
  careerTier?: number;
  children?: number;
  alive?: boolean;
  moved?: boolean;
  partnerId?: string | null;
  flags?: string[];
}

export interface NpcEdgeDelta {
  kind?: NpcEdge["kind"];
  affinity?: number;
  trust?: number;
}

export interface NpcSchemeResult {
  /** The NPC taking the action (always the one whose class returned this). */
  actorId: string;
  /** The peer acted upon, if any. Omit for a scheme aimed only at the player. */
  targetId?: string;
  /** Changes to the actor's own life. */
  actor?: NpcLifeDelta;
  /** Changes to the target peer's life. */
  target?: NpcLifeDelta;
  /** Change to the actor↔target edge (only meaningful with a `targetId`). */
  edge?: NpcEdgeDelta;
  /** Impact on the player — applied only when the actor is known to them. */
  player?: NpcPlayerImpact;
  /** Narration i18n key for the player's journal. */
  logKey?: string;
}

/** One living NPC plus its life, handed to a scheme. */
export interface NpcPeer {
  npc: Npc;
  life: NpcLife;
}

/**
 * The read-only world view a scheme is given. It exposes only what behaviour
 * needs (randomness, player age/affinity, peers and the social graph) so an
 * archetype can't reach into the simulator or the UI.
 */
export interface NpcYearContext {
  random: RandomSource;
  /** The player's current age (0 when unknown). */
  playerAge: number;
  /** All living NPCs. */
  peers: NpcPeer[];
  life(npcId: string): NpcLife | undefined;
  edge(a: string, b: string): NpcEdge | undefined;
  bond(npcId: string): NpcBond;
  /** The player's scalar affinity (0..100) with an NPC. */
  playerAffinity(npcId: string): number;
  /** Whether the player knows this NPC at the current age. */
  knowsPlayer(npcId: string): boolean;
}
