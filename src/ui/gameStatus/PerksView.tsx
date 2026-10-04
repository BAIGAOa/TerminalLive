import React from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { PERKS } from "../../game/perks.js";
import { meetsRequirement } from "../../world/requirements.js";
import { StatusScroll } from "./common.js";

export default function PerksView({
  player,
  t,
  height,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  const unlocked = PERKS.filter((p) => meetsRequirement(player, p.requirement)).length;

  const lines: React.ReactNode[] = [
    <Text color="cyan" bold>
      {t("game.perks.title")} ({unlocked}/{PERKS.length})
    </Text>,
    null,
    ...PERKS.map((perk) => {
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
    }),
  ];

  return <StatusScroll height={height} lines={lines} />;
}
