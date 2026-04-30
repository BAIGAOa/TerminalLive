import { random } from "lodash-es";
import { IncidentParameter } from "../../Incident.js";
import Player from "../../Player.js";
import AcademicStressEvent from "./AcademicStressEvent.js";

export interface AcademicAngerParameter extends IncidentParameter {
    angerCoefficient?: number
}

export default class AcademicAnger extends AcademicStressEvent {
    public angerCoefficient!: number

    constructor(parameter: AcademicAngerParameter) {
        super(parameter)
    }

    public apply(player: Player): void {
        super.apply(player)

        player.angerValue += random(0, this.angerCoefficient)
    }


    protected setup(parameter: AcademicAngerParameter): void {
        this.angerCoefficient = parameter.angerCoefficient ?? 1

        super.setup(parameter)
    }
}
