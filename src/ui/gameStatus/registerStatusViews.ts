import React from "react";
import { container } from "../../Container.js";
import GameStatusMap from "../../core/registry/GameStatusMap.js";
import AttributesView from "./AttributesView.js";
import SkillsView from "./SkillsView.js";
import EffectsView from "./EffectsView.js";
import InventoryView from "./InventoryView.js";
import RelationshipsView from "./RelationshipsView.js";
import CareerView from "./CareerView.js";
import PerksView from "./PerksView.js";
import WorldView from "./WorldView.js";
import PressuresView from "./PressuresView.js";
import EconomyView from "./EconomyView.js";
import HealthView from "./HealthView.js";
import PoliticsView from "./PoliticsView.js";
import RegionView from "./RegionView.js";

/**
 * Register the status-screen components into `GameStatusMap`.
 *
 * Lives in the UI layer (called from the composition root, `main.tsx`) so that
 * `src/content/` never has to import React components — the content layer only
 * names status ids, the UI layer decides what renders for each id.
 */
export function registerStatusViews(): void {
  const map = container.resolve(GameStatusMap);
  // Status views are heterogeneous; props are supplied by the caller's screen.
  const entry = (View: React.ComponentType<any>) =>
    (props?: any) => React.createElement(View, props);

  map.register("attributes", entry(AttributesView));
  map.register("skills", entry(SkillsView));
  map.register("effects", entry(EffectsView));
  map.register("inventory", entry(InventoryView));
  map.register("relationships", entry(RelationshipsView));
  map.register("career", entry(CareerView));
  map.register("perks", entry(PerksView));
  map.register("world", entry(WorldView));
  map.register("pressures", entry(PressuresView));
  map.register("economy", entry(EconomyView));
  map.register("health", entry(HealthView));
  map.register("politics", entry(PoliticsView));
  map.register("regions", entry(RegionView));
}
