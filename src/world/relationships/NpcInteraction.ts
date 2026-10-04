import { Requirement, StatDelta } from "../stats.js";
import { KarmaDelta } from "../chronicle/karma.js";

/**
 * A player-initiated interaction offered on an NPC's card (talk, gift, help,
 * confide, quarrel, reconcile, shared activity…). `affinity` always applies to
 * the NPC being interacted with.
 */
export interface NpcInteractionDef {
  id: string;
  labelKey: string;
  descKey: string;
  icon?: string;
  /** Action points consumed (default 1). */
  apCost?: number;
  minAge?: number;
  maxAge?: number;
  /** Gates; the interaction is greyed out when unmet (e.g. affinity floor). */
  requires?: Requirement[];
  /** Minimum affinity with THIS npc required to offer the interaction. */
  minAffinity?: number;
  effects?: StatDelta;
  items?: string[];
  /** Affinity change applied to THIS npc. */
  affinity?: number;
  buff?: { id: string; turns?: number };
  flag?: string;
  karma?: KarmaDelta;
  /** Narration shown after the interaction (also written to the journal). */
  resultKey: string;
}

export type InteractionReason = "ap" | "age" | "require" | "gone";

export interface InteractionView {
  def: NpcInteractionDef;
  available: boolean;
  reason?: InteractionReason;
}
