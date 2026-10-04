import { Incident, IncidentParameter } from "../Incident.js";
import Player from "../Player.js";

/**
 * A journal-only pseudo-event: it carries a translation key for the log/report
 * but applies nothing. Used to narrate NPC autonomy + interaction outcomes.
 */
export class NpcLogIncident extends Incident {
  constructor(id: string, nameKey: string) {
    super({ id, nameKey, rangeKey: ["0-100"] } as IncidentParameter);
  }

  public apply(_player: Player): void {
    /* narration only */
  }
}
