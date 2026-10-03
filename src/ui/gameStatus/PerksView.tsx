import React from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { PERKS } from "../../game/perks.js";
import { meetsRequirement } from "../../world/requirements.js";

export default function PerksView({
  player,
  t,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const unlocked = PERKS.filter((p) => meetsRequirement(player, p.requirement)).length;
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {t("game.perks.title")} ({unlocked}/{PERKS.length})
        </Text>
      </Box>
      {PERKS.map((perk) => {
        const on = meetsRequirement(player, perk.requirement);
        return (
          <Box key={perk.id} flexDirection="row">
            <Text color={on ? "green" : "gray"}>
              {on ? "★" : "☆"} {perk.icon ?? ""} {t(perk.labelKey)}
            </Text>
            <Text dimColor>
              {"  "}
              {t(perk.descKey)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
