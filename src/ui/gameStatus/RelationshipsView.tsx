import React from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import NpcRegistry from "../../world/relationships/NpcRegistry.js";
import { bar } from "./common.js";

function affinityColor(v: number): string {
  if (v >= 70) return "green";
  if (v >= 40) return "yellow";
  if (v >= 20) return "white";
  return "red";
}

export default function RelationshipsView({
  player,
  t,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const npcReg = container.resolve(NpcRegistry);
  const npcs = npcReg.getAll();

  const known = npcs.map((npc) => ({
    npc,
    value: player.getRelationship(npc.id),
  }));

  if (known.every((k) => k.value <= 0)) {
    return <Text dimColor>{t("game.relationships.empty")}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {t("game.relationships.title")}
        </Text>
      </Box>
      {known.map(({ npc, value }) => (
        <Box key={npc.id} flexDirection="row">
          <Box width={14}>
            <Text>{t(npc.labelKey)}</Text>
          </Box>
          <Text color={affinityColor(value)}>{bar(value, 16)}</Text>
          <Text> {value}</Text>
        </Box>
      ))}
    </Box>
  );
}
