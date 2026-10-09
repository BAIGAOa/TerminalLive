import { definePluginManifest } from "../../core/plugin/manifest.js";
import type { Plugin } from "../../core/plugin/types.js";
import AttributesView from "../../ui/gameStatus/AttributesView.js";
import SkillsView from "../../ui/gameStatus/SkillsView.js";
import EffectsView from "../../ui/gameStatus/EffectsView.js";
import InventoryView from "../../ui/gameStatus/InventoryView.js";
import RelationshipsView from "../../ui/gameStatus/RelationshipsView.js";
import CareerView from "../../ui/gameStatus/CareerView.js";
import PerksView from "../../ui/gameStatus/PerksView.js";
import WorldView from "../../ui/gameStatus/WorldView.js";
import PressuresView from "../../ui/gameStatus/PressuresView.js";
import EconomyView from "../../ui/gameStatus/EconomyView.js";
import HealthView from "../../ui/gameStatus/HealthView.js";
import PoliticsView from "../../ui/gameStatus/PoliticsView.js";
import RegionView from "../../ui/gameStatus/RegionView.js";

export const id = "core.status-views";

export const manifest = definePluginManifest({
  id,
  nameKey: "plugin.core.statusViews.name",
  descKey: "plugin.core.statusViews.desc",
  capabilities: ["ui"],
});

/**
 * The in-game status panels.
 *
 * Each panel is published under its own id, so a plugin that provides the same
 * id takes that panel over — replace the inventory screen with your own and the
 * rest of the game neither knows nor cares. Loading last wins, which is why the
 * game's own plugins load first.
 */
export const plugin: Plugin = {
  id,
  hooks: {
    onInit(ctx) {
      ctx.addStatusView("attributes", AttributesView);
      ctx.addStatusView("skills", SkillsView);
      ctx.addStatusView("effects", EffectsView);
      ctx.addStatusView("inventory", InventoryView);
      ctx.addStatusView("relationships", RelationshipsView);
      ctx.addStatusView("career", CareerView);
      ctx.addStatusView("perks", PerksView);
      ctx.addStatusView("world", WorldView);
      ctx.addStatusView("pressures", PressuresView);
      ctx.addStatusView("economy", EconomyView);
      ctx.addStatusView("health", HealthView);
      ctx.addStatusView("politics", PoliticsView);
      ctx.addStatusView("regions", RegionView);
    },
  },
};
