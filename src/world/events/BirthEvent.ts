import { Incident, IncidentParameter } from "../Incident.js";
import Player from "../Player.js";



export default class BirthEvent extends Incident {
    constructor(parameter: IncidentParameter) {
        super(parameter)

        this.setup(parameter)
    }

    public apply(_player: Player) {

    }


}
