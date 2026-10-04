import React, { useSyncExternalStore } from "react";
import { Text } from "ink";
import { container } from "../../Container.js";
import WorldState from "../../world/chronicle/WorldState.js";
import WorldRegistry from "../../world/chronicle/WorldRegistry.js";
import RegionsSystem from "../../world/regions/RegionsSystem.js";
import { prosperityTier } from "../../world/regions/regionEngine.js";
import { bar, StatusScroll } from "./common.js";

/** The world's regions: development, population, stability and your whereabouts. */
export default function RegionView({
  t,
  height,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  const world = container.resolve(WorldState);
  const reg = container.resolve(WorldRegistry);
  const regions = container.resolve(RegionsSystem);
  useSyncExternalStore(world.subscribe, world.getSnapshot);

  const state = regions.getState();
  const lines: React.ReactNode[] = [
    <Text color="cyan" bold>
      {t("region.title")}
    </Text>,
    null,
  ];

  for (const sim of Object.values(state.regions)) {
    const def = reg.getRegion(sim.id);
    const current = sim.id === state.currentId;
    const neighbors = regions
      .neighbors(sim.id)
      .map((id) => t(reg.getRegion(id)?.labelKey ?? id))
      .join(" · ");
    lines.push(
      <Text key={sim.id} color={current ? "cyanBright" : "white"}>
        {current ? "◆ " : "  "}
        {def ? t(def.labelKey) : sim.id} — <Text color="yellow">{t(prosperityTier(sim))}</Text>
      </Text>,
      <Text dimColor>
        {"    "}
        {t("region.prosperity")} {bar(sim.prosperity, 8)}
        {"  "}
        {t("region.stability")} {bar(sim.stability, 6)}
      </Text>,
      neighbors ? (
        <Text key={`${sim.id}_n`} dimColor>
          {"    "}
          {t("region.neighbors")}: {neighbors}
        </Text>
      ) : null,
    );
  }

  return <StatusScroll height={height} lines={lines} />;
}
