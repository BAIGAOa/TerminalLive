import React, { useSyncExternalStore } from "react";
import { Box, Text } from "ink";
import { container } from "../../Container.js";
import WorldState from "../../world/chronicle/WorldState.js";
import WorldRegistry from "../../world/chronicle/WorldRegistry.js";
import { KARMA_AXES, KarmaAxis } from "../../world/chronicle/karma.js";
import WeatherState from "../../world/weather/WeatherState.js";
import { seasonOf } from "../../world/weather/WeatherDefinition.js";

const AXIS_COLOR: Record<KarmaAxis, string> = {
  benevolence: "green",
  ambition: "yellow",
  wisdom: "cyan",
  rebellion: "magenta",
};

export default function WorldView({
  t,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const world = container.resolve(WorldState);
  const reg = container.resolve(WorldRegistry);
  const weather = container.resolve(WeatherState);
  useSyncExternalStore(world.subscribe, world.getSnapshot);
  useSyncExternalStore(weather.subscribe, weather.getSnapshot);

  const era = reg.getEras().find((e) => e.id === world.eraId);
  const region = reg.getRegion(world.regionId);
  const factions = reg.getFactions();
  const weatherDef = weather.current();
  const season = seasonOf(world.year);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {t("world.title")}
        </Text>
      </Box>

      <Text>
        {t("world.era")}:{" "}
        <Text color={era?.color ?? "white"}>
          {era ? `${era.icon ?? ""} ${t(era.labelKey)}` : "-"}
        </Text>
      </Text>
      <Text>
        {t("world.region")}:{" "}
        <Text color="yellow">
          {region ? `${region.icon ?? ""} ${t(region.labelKey)}` : "-"}
        </Text>
      </Text>
      <Text>
        {t("world.weather")}:{" "}
        <Text color={weatherDef?.color ?? "white"}>
          {weatherDef ? `${weatherDef.icon ?? ""} ${t(weatherDef.labelKey)}` : "-"}
        </Text>
        <Text dimColor>  ({t(`season.${season}`)})</Text>
      </Text>
      {region?.neighbors && region.neighbors.length > 0 ? (
        <Text dimColor>
          {t("world.neighbors")}:{" "}
          {region.neighbors
            .map((id) => t(reg.getRegion(id)?.labelKey ?? id))
            .join(" · ")}
        </Text>
      ) : null}

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>── {t("world.karma")} ──</Text>
        {KARMA_AXES.map((axis) => {
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
        })}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>── {t("world.factions")} ──</Text>
        {factions.length === 0 ? (
          <Text dimColor>{t("world.noFaction")}</Text>
        ) : (
          factions.map((f) => {
            const s = world.standing.get(f.id) ?? 0;
            const color = s >= 40 ? "green" : s > 0 ? "yellow" : "gray";
            return (
              <Text key={f.id}>
                {f.icon ?? ""} {t(f.labelKey)}:{" "}
                <Text color={color}>{s}</Text>
              </Text>
            );
          })
        )}
      </Box>

      {world.activeFates.size > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green" bold>
            {t("world.title")} ✦
          </Text>
          {reg
            .getFates()
            .filter((f) => world.activeFates.has(f.id))
            .map((f) => (
              <Text key={f.id} color="green">
                ✦ {f.icon ?? ""} {t(f.labelKey)}
              </Text>
            ))}
        </Box>
      )}
    </Box>
  );
}
