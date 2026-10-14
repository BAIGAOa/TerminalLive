import { Incident, IncidentParameter } from "../Incident.js";
import Player from "../Player.js";

/**
 * A journal-only entry about a region — the same trick as `NpcLogIncident`: it
 * carries a translation key for the log and applies nothing.
 *
 * Its own class rather than reusing `NpcLogIncident`, because a region is not an
 * NPC and the mail system's journal reader classifies by exactly that type.
 */
export class RegionLogIncident extends Incident {
  constructor(id: string, nameKey: string) {
    super({ id, nameKey, rangeKey: ["0-100"] } as IncidentParameter);
  }

  public apply(_player: Player): void {
    /* narration only */
  }
}
