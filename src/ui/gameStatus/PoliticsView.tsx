import React, { useSyncExternalStore } from "react";
import { Text } from "ink";
import { container } from "../../Container.js";
import WorldState from "../../world/chronicle/WorldState.js";
import ChronicleRegistry from "../../world/chronicle/ChronicleRegistry.js";
import PoliticsSystem from "../../world/politics/PoliticsSystem.js";
import { POLICIES, relationKind } from "../../world/politics/politicsEngine.js";
import { bar, StatusScroll } from "./common.js";

/** Faction power blocs: relations, tension, enacted policies, the player's lean. */
export default function PoliticsView({
  t,
  height,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  const world = container.resolve(WorldState);
  const reg = container.resolve(ChronicleRegistry);
  const politics = container.resolve(PoliticsSystem);
  useSyncExternalStore(world.subscribe, world.getSnapshot);

  const state = politics.getState();
  const dominant = politics.dominantFaction();

  const lines: React.ReactNode[] = [
    <Text color="cyan" bold>
      {t("politics.title")}
    </Text>,
    <Text>
      {t("politics.tension")}{" "}
      <Text color={state.tension > 65 ? "red" : "yellow"}>{bar(state.tension, 12)}</Text>
      {"   "}
      {t("politics.order")}:{" "}
      <Text color={politics.publicOrder() < 40 ? "red" : "green"}>
        {politics.publicOrder()}
      </Text>
    </Text>,
    <Text dimColor>
      {t("politics.marketBias")}: {(politics.marketBias() * 100).toFixed(1)}%
    </Text>,
    null,
    <Text dimColor>── {t("politics.factions")} ──</Text>,
  ];

  for (const f of Object.values(state.factions)) {
    const def = reg.getFaction(f.id);
    const isDom = f.id === dominant;
    const isLean = f.id === state.playerLean;
    const rels = Object.entries(f.relation)
      .filter(([, v]) => Math.abs(v) >= 30)
      .map(([id, v]) => `${t(reg.getFaction(id)?.labelKey ?? id)}(${t(`politics.rel.${relationKind(v)}`)})`);
    lines.push(
      <Text key={f.id} color={isDom ? "yellowBright" : isLean ? "cyanBright" : "white"}>
        {isLean ? "★ " : "  "}
        {def ? t(def.labelKey) : f.id} {bar(f.power, 8)}
        {rels.length > 0 ? <Text dimColor>  {rels.join(" ")}</Text> : null}
      </Text>,
    );
  }

  const standing = Object.entries(Object.fromEntries(world.standing)).filter(
    ([, v]) => v !== 0,
  );
  if (standing.length > 0) {
    lines.push(
      null,
      <Text dimColor>
        {t("politics.standing")}:{" "}
        {standing
          .map(([id, v]) => `${t(reg.getFaction(id)?.labelKey ?? id)} ${v > 0 ? "+" : ""}${v}`)
          .join("  ")}
      </Text>,
    );
  }

  lines.push(
    null,
    <Text dimColor>── {t("politics.policies")} ──</Text>,
    state.policies.length === 0 ? (
      <Text dimColor>{t("politics.none")}</Text>
    ) : (
      <Text color="magenta">
        {state.policies
          .map((id) => t(POLICIES.find((p) => p.id === id)?.labelKey ?? id))
          .join("  ·  ")}
      </Text>
    ),
  );

  if (state.playerLean) {
    const def = reg.getFaction(state.playerLean);
    lines.push(
      <Text color="cyanBright">
        {t("politics.lean")}: {def ? t(def.labelKey) : state.playerLean}
      </Text>,
    );
  }

  return <StatusScroll height={height} lines={lines} />;
}
