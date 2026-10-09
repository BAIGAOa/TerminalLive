import { Incident, IncidentParameter } from "../Incident.js";
import Player from "../Player.js";
import { ChoiceDef } from "../choices.js";
import { NpcAutonomyDef } from "./NpcAutonomy.js";

/**
 * A synthetic, choice-bearing event raised by an NPC's autonomous behaviour
 * (`kind: "offer"`). It is not in the EventCenter, so it is offered through the
 * algorithm's external-choice channel and the player answers it in the usual
 * choice modal. Options' affinity deltas target the offering NPC.
 *
 * It carries `origin: "npc"` so that dialog can present it as one of the cast
 * asking something, rather than as the world rolling an event — the two are
 * otherwise identical on screen.
 */
export class NpcOfferIncident extends Incident {
  /** The NPC who raised this, so the dialog can name them. */
  public readonly npcId: string;

  constructor(npcId: string, def: NpcAutonomyDef) {
    const choices: ChoiceDef[] = (def.options ?? []).map((o) => ({
      id: o.id,
      labelKey: o.labelKey,
      effects: o.effects,
      items: o.items,
      relationship: o.affinity ? { npc: npcId, delta: o.affinity } : undefined,
      buff: o.buff,
      flag: o.flag,
      karma: o.karma,
      noteKey: o.resultKey,
    }));
    super({
      id: `npc_offer_${npcId}_${def.id}`,
      nameKey: def.labelKey,
      textKey: def.offerTextKey,
      choices,
      rangeKey: ["0-100"],
      origin: "npc",
    } as IncidentParameter);
    this.npcId = npcId;
  }

  public apply(_player: Player): void {
    /* resolved through the choice channel */
  }
}
