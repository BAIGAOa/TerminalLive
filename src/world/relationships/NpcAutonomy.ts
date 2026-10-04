import { StatDelta } from "../stats.js";
import { KarmaDelta } from "../chronicle/karma.js";

/** One branch of an NPC-initiated offer (reuses the choice modal). */
export interface NpcOfferOption {
  id: string;
  labelKey: string;
  effects?: StatDelta;
  items?: string[];
  /** Affinity applied to the NPC who made the offer. */
  affinity?: number;
  buff?: { id: string; turns?: number };
  flag?: string;
  /** Karma written to the ledger when this branch is chosen. */
  karma?: KarmaDelta;
  /** Outcome narration (also written to the journal). */
  resultKey?: string;
}

/**
 * Something an NPC may do on their own at the turn of a year. `passive` fires
 * quietly (journal + toast); `offer` pauses the turn with a choice modal.
 */
export interface NpcAutonomyDef {
  id: string;
  labelKey: string;
  weight: number;
  minAffinity?: number;
  maxAffinity?: number;
  minAge?: number;
  maxAge?: number;
  kind: "passive" | "offer";
  /** Passive payload (ignored for offers). */
  effects?: StatDelta;
  items?: string[];
  /** Affinity applied to THIS npc. */
  affinity?: number;
  buff?: { id: string; turns?: number };
  flag?: string;
  /** Passive narration (journal + toast). */
  resultKey?: string;
  /** Offer: prompt body shown in the choice modal. */
  offerTextKey?: string;
  /** Offer: the branches the player picks from. */
  options?: NpcOfferOption[];
}
