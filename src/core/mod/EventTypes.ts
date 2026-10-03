import AcademicAnger from "../../world/events/Academic/AcademicAnger.js";
import AcademicStressEvent from "../../world/events/Academic/AcademicStressEvent.js";
import BirthEvent from "../../world/events/BirthEvent.js";
import ChoiceEvent from "../../world/events/ChoiceEvent.js";
import EffectEvent from "../../world/events/EffectEvent.js";
import { container } from "../../Container.js";
import EventTypeRegistry from "./EventTypeRegistry.js";
export default class EventTypes {
  private static init = false;

  public static registerAll(): void {
    if (this.init) return;
    this.init = true;

    const registry = container.resolve(EventTypeRegistry);

    registry.register("BirthEvent", BirthEvent);
    registry.register("ChoiceEvent", ChoiceEvent);
    registry.register("EffectEvent", EffectEvent);
    registry.register("AcademicStressEvent", AcademicStressEvent);
    registry.register("AcademicAnger", AcademicAnger);

    // EXAMPLE: registry.register("NewEvent", NewEvent);
  }
}
