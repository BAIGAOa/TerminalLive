import React from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import EffectRegistry from "../../world/effects/EffectRegistry.js";

export default function EffectsView({
  player,
  t,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const reg = container.resolve(EffectRegistry);

  if (player.activeEffects.length === 0) {
    return <Text dimColor>{t("game.effects.none")}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {t("game.effects.title")} ({player.activeEffects.length})
        </Text>
      </Box>
      {player.activeEffects.map((eff) => {
        const def = reg.get(eff.id);
        const color =
          def?.color ?? (def?.kind === "buff" ? "green" : "red");
        return (
          <Box key={eff.id} flexDirection="row">
            <Text color={color}>
              {def?.kind === "buff" ? "▲" : "▼"} {def?.icon ?? ""}{" "}
              {t(def?.labelKey ?? eff.id)}
            </Text>
            <Text dimColor>
              {"  "}
              {t("game.effects.turns", { n: eff.remaining })}
            </Text>
            {eff.stacks > 1 ? <Text color={color}> x{eff.stacks}</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
}
