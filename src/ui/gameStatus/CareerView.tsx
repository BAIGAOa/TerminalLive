import React from "react";
import { Box, Text } from "ink";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import CareerSystem from "../../world/careers/CareerSystem.js";
import { bar } from "./common.js";

/** The player's job: track, rank, salary and the next promotion's gates. */
export default function CareerView({
  player,
  t,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const careers = container.resolve(CareerSystem);
  const state = careers.getState(player);

  if (!state) {
    return (
      <Box flexDirection="column">
        <Text dimColor>{t("career.none")}</Text>
        <Text dimColor>{t("career.none.hint")}</Text>
      </Box>
    );
  }

  const { career, rank, rankDef, salary, next } = state;
  const maxRank = career.ranks.length;

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <Text bold color="yellow">
          {t(career.labelKey)}
        </Text>
        <Text color="cyan">
          {t("career.rankOf", { rank: rank + 1, max: maxRank })}
        </Text>
      </Box>

      <Box flexDirection="row">
        <Text>{t("career.rank")}: </Text>
        <Text bold color="greenBright">
          {t(rankDef.titleKey)}
        </Text>
      </Box>
      <Box flexDirection="row">
        <Text>{t("career.salary")}: </Text>
        <Text color="yellow">
          ${salary}
          <Text dimColor>{t("career.perYear")}</Text>
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {next ? (
          <>
            <Text color="white">
              {t("career.next", { title: t(next.rankDef.titleKey) })}
            </Text>
            {next.rankDef.requires.map((req, i) => {
              const value =
                req.npc !== undefined
                  ? player.getRelationship(req.npc)
                  : req.prop !== undefined
                    ? player.getStat(req.prop)
                    : 0;
              const need = req.gte ?? req.lte ?? 0;
              const met =
                (req.gte === undefined || value >= req.gte) &&
                (req.lte === undefined || value <= req.lte);
              const propName = req.prop
                ? t(`playerConfig.attr.${req.prop}`)
                : t("career.requirement");
              return (
                <Text key={i} color={met ? "green" : "gray"}>
                  {"  "}
                  {met ? "✓" : "○"} {propName} {value}/{need}
                </Text>
              );
            })}
            <Box marginTop={1}>
              <Text color="gray">{bar(next.met ? 100 : 0, 18)}</Text>
            </Box>
          </>
        ) : (
          <Text color="greenBright">{t("career.max")}</Text>
        )}
      </Box>
    </Box>
  );
}
