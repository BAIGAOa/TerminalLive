import React from "react";
import { container } from "../Container.js";
import AttributesView from "../ui/gameStatus/AttributesView.js";
import StatusEffectsView from "../ui/gameStatus/StatusEffectsView.js";
import GameStatusMap from "../core/registry/GameStatusMap.js";

export default class GameStatus {
  public static init: boolean = false;

  public static load(): void {
    if (this.init) return;
    this.init = true;

    const map = container.resolve(GameStatusMap);

    map.register("attributes", (props?: any) =>
      React.createElement(AttributesView, props),
    );

    map.register("status", (props?: any) =>
      React.createElement(StatusEffectsView, props),
    );
  }
}
