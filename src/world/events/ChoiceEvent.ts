import { Incident, IncidentParameter } from "../Incident.js";
import Player from "../Player.js";

/**
 * A JSON-driven event whose outcome is chosen by the player. Its own `apply`
 * is a no-op — the algorithm pauses and applies the selected branch instead
 * (see `DefaultEventAlgorithm.offerChoice` / `resolveChoice`).
 */
export default class ChoiceEvent extends Incident {
  constructor(parameter: IncidentParameter) {
    super(parameter);
  }

  public apply(_player: Player): void {
    /* outcome comes from the selected choice */
  }
}
