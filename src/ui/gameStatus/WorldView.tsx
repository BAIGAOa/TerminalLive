import React, { useSyncExternalStore } from "react";
import { Text } from "ink";
import { container } from "../../Container.js";
import WorldState from "../../world/chronicle/WorldState.js";
import ChronicleRegistry from "../../world/chronicle/ChronicleRegistry.js";
import { KARMA_AXES, KarmaAxis } from "../../world/chronicle/karma.js";
import WeatherState from "../../world/weather/WeatherState.js";
import { seasonOf } from "../../world/weather/WeatherDefinition.js";
import WorldChainSystem from "../../world/chains/WorldChainSystem.js";
import { worldChainsById } from "../../content/WorldChains.js";
import NarrativeSystem from "../../world/narrative/NarrativeSystem.js";
import ConfigStore from "../../core/store/ConfigStore.js";
import { StatusScroll } from "./common.js";

const AXIS_COLOR: Record<KarmaAxis, string> = {
  benevolence: "green",
  ambition: "yellow",
  wisdom: "cyan",
  rebellion: "magenta",
};

export default function WorldView({
  t,
  height,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  const world = container.resolve(WorldState);
  const reg = container.resolve(ChronicleRegistry);
  const weather = container.resolve(WeatherState);
  const configStore = container.resolve(ConfigStore);
  useSyncExternalStore(world.subscribe, world.getSnapshot);
  useSyncExternalStore(weather.subscribe, weather.getSnapshot);
  useSyncExternalStore(configStore.subscribe, configStore.getSnapshot);
  const simplified = configStore.getSimplified();

  const era = reg.getEras().find((e) => e.id === world.eraId);
  const region = reg.getRegion(world.regionId);
  const factions = reg.getFactions();
  const weatherDef = weather.current();
  const season = seasonOf(world.year);

  const lines: React.ReactNode[] = [
    <Text color="cyan" bold>
      {t("world.title")}
    </Text>,
    null,
    <Text>
      {t("world.era")}:{" "}
      <Text color={era?.color ?? "white"}>
        {era ? `${era.icon ?? ""} ${t(era.labelKey)}` : "-"}
      </Text>
    </Text>,
    <Text>
      {t("world.region")}:{" "}
      <Text color="yellow">
        {region ? `${region.icon ?? ""} ${t(region.labelKey)}` : "-"}
      </Text>
    </Text>,
    <Text>
      {t("world.weather")}:{" "}
      <Text color={weatherDef?.color ?? "white"}>
        {weatherDef ? `${weatherDef.icon ?? ""} ${t(weatherDef.labelKey)}` : "-"}
      </Text>
      <Text dimColor>  ({t(`season.${season}`)})</Text>
    </Text>,
  ];

  if (!simplified && region?.neighbors && region.neighbors.length > 0) {
    lines.push(
      <Text dimColor>
        {t("world.neighbors")}:{" "}
        {region.neighbors
          .map((id) => t(reg.getRegion(id)?.labelKey ?? id))
          .join(" · ")}
      </Text>,
    );
  }

  if (!simplified)
    lines.push(
      null,
      <Text dimColor>── {t("world.karma")} ──</Text>,
    ...KARMA_AXES.map((axis) => {
      const v = world.karma[axis];
      const color = v > 0 ? AXIS_COLOR[axis] : v < 0 ? "red" : "gray";
      return (
        <Text key={axis}>
          {t(`world.karmaAxis.${axis}`)}:{" "}
          <Text color={color}>
            {v > 0 ? "+" : ""}
            {v}
          </Text>
        </Text>
      );
    }),
    null,
    <Text dimColor>── {t("world.factions")} ──</Text>,
  );

  if (simplified) {
    // Simplified mode hides the faction block.
  } else if (factions.length === 0) {
    lines.push(<Text dimColor>{t("world.noFaction")}</Text>);
  } else {
    lines.push(
      ...factions.map((f) => {
        const s = world.standing.get(f.id) ?? 0;
        const color = s >= 40 ? "green" : s > 0 ? "yellow" : "gray";
        return (
          <Text key={f.id}>
            {f.icon ?? ""} {t(f.labelKey)}:{" "}
            <Text color={color}>{s}</Text>
          </Text>
        );
      }),
    );
  }

  if (!simplified && world.activeFates.size > 0) {
    lines.push(
      null,
      <Text color="green" bold>
        {t("world.fates")} ✦
      </Text>,
      ...reg
        .getFates()
        .filter((f) => world.activeFates.has(f.id))
        .map((f) => (
          <Text key={f.id} color="green">
            ✦ {f.icon ?? ""} {t(f.labelKey)}
          </Text>
        )),
    );
  }

  const chains = container.resolve(WorldChainSystem).activeChains();
  if (!simplified && chains.length > 0) {
    const defs = worldChainsById();
    lines.push(
      null,
      <Text color="red" bold>
        {t("world.chains")}
      </Text>,
      ...chains.map((id) => (
        <Text key={id} color="yellow">
          ⚔ {t(defs[id]?.labelKey ?? id)}
        </Text>
      )),
    );
  }

  const arcs = container.resolve(NarrativeSystem).getArcs();
  if (!simplified && arcs.length > 0) {
    lines.push(
      null,
      <Text color="cyan" bold>
        {t("world.arcs")}
      </Text>,
      ...arcs.map((a) => (
        <Text
          key={a.def.id}
          color={a.state.stage >= a.def.stages.length ? "green" : "white"}
        >
          {t(a.def.labelKey)} — {a.state.stage}/{a.def.stages.length}
          {a.state.stage >= a.def.stages.length ? " ✓" : ""}
        </Text>
      )),
    );
  }

  return <StatusScroll height={height} lines={lines} />;
}
