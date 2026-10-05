import { container } from "../Container.js";
import WorldConditionRegistry from "../core/registry/WorldConditionRegistry.js";
import GeneralPurpose, {
  GeneralPurposeScheme,
} from "../worlds/conditions/GeneralPurpose.js";

export default class Conditions {
  public static init: boolean = false;

  public static load() {
    if (!this.init) {
      this.init = true;
      const register = container.resolve(WorldConditionRegistry);

      register.register("generalPurpose", {
        ctor: GeneralPurpose,
        schema: GeneralPurposeScheme,
      });
    }
  }
}
