import { container } from "../Container.js"
import GeneralPurpose, { GeneralPurposeScheme } from "../level/conditions/GeneralPurpose.js"
import LevelConditionRegistry from "../level/registry/LevelConditionRegistry.js"



export default class Conditions {
    public static init: boolean = false

    public static load() {
        if (!this.init) {
            this.init = true
            const register = container.resolve(LevelConditionRegistry)

            register.addCondition('generalPurpose', GeneralPurpose, GeneralPurposeScheme)
        }
    }
}
