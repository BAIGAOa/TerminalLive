import { Incident, IncidentParameter } from "../../Incident.js";
import Player from "../../Player.js";



export default class AcademicStressEvent extends Incident {


    constructor(parameter: IncidentParameter) {
        super(parameter)
    }

    public apply(player: Player): void {
        player.depressionValue++
    }
}
