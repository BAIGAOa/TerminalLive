import { Incident, IncidentParameter } from "../Incident.js";
import Player from "../Player.js";
import { applyEffectPayload, EffectPayload } from "../effects/applyEffects.js";

/**
 * A JSON-driven event that applies a declarative effect payload from
 * `params`: `{ effects, items, removeItems, relationship, buff, flag }`.
 * Lets simple events be authored entirely in data.
 */
export default class EffectEvent extends Incident {
  private payload: EffectPayload;

  constructor(parameter: IncidentParameter) {
    super(parameter);
    this.payload = (parameter.params ?? {}) as EffectPayload;
  }

  public apply(player: Player): void {
    applyEffectPayload(player, this.payload);
  }
}
