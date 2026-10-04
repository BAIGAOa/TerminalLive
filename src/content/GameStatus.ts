import React from "react";
import { container } from "../Container.js";
import AttributesView from "../ui/gameStatus/AttributesView.js";
import SkillsView from "../ui/gameStatus/SkillsView.js";
import EffectsView from "../ui/gameStatus/EffectsView.js";
import InventoryView from "../ui/gameStatus/InventoryView.js";
import RelationshipsView from "../ui/gameStatus/RelationshipsView.js";
import CareerView from "../ui/gameStatus/CareerView.js";
import PerksView from "../ui/gameStatus/PerksView.js";
import WorldView from "../ui/gameStatus/WorldView.js";
import PressuresView from "../ui/gameStatus/PressuresView.js";
import EconomyView from "../ui/gameStatus/EconomyView.js";
import HealthView from "../ui/gameStatus/HealthView.js";
import PoliticsView from "../ui/gameStatus/PoliticsView.js";
import RegionView from "../ui/gameStatus/RegionView.js";
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
    map.register("skills", (props?: any) =>
      React.createElement(SkillsView, props),
    );
    map.register("effects", (props?: any) =>
      React.createElement(EffectsView, props),
    );
    map.register("inventory", (props?: any) =>
      React.createElement(InventoryView, props),
    );
    map.register("relationships", (props?: any) =>
      React.createElement(RelationshipsView, props),
    );
    map.register("career", (props?: any) =>
      React.createElement(CareerView, props),
    );
    map.register("perks", (props?: any) =>
      React.createElement(PerksView, props),
    );
    map.register("world", (props?: any) =>
      React.createElement(WorldView, props),
    );
    map.register("pressures", (props?: any) =>
      React.createElement(PressuresView, props),
    );
    map.register("economy", (props?: any) =>
      React.createElement(EconomyView, props),
    );
    map.register("health", (props?: any) =>
      React.createElement(HealthView, props),
    );
    map.register("politics", (props?: any) =>
      React.createElement(PoliticsView, props),
    );
    map.register("regions", (props?: any) =>
      React.createElement(RegionView, props),
    );
  }
}
