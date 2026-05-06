import React from "react";
import { container } from "../Container.js";
import GameStatusMap from "../core/GameStatusMap.js";
import AttributesView from "../ui/gameStatus/AttributesView.js";
import StatusEffectsView from "../ui/gameStatus/StatusEffectsView.js";

export default class GameStatus {
    public static init: boolean = false;

    public static load(): void {
        if (this.init) return;
        this.init = true;

        const map = container.resolve(GameStatusMap);

        map.addStatus("attributes", (props?: any) =>
            React.createElement(AttributesView, props),
        );

        map.addStatus("status", (props?: any) =>
            React.createElement(StatusEffectsView, props),
        );
    }
}