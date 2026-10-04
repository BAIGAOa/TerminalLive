import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { Button, ModalFrame } from "./kit/index.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { presentModal } from "./layers/modalBus.js";
import LifeReview from "./LifeReview.js";
import type { StatKey } from "../world/stats.js";

export interface GameOverLineage {
  endedGeneration: number;
  nextGeneration: number;
  /** This life's moral alignment key (karma.*). */
  epithetKey: string;
  /** What the next generation inherits from this life. */
  inheritedMoney: number;
  inheritedStats: Array<{ key: StatKey; value: number }>;
}

export interface GameOverInfo {
  reason: "death" | "complete";
  age: number;
  playerName: string;
  money: number;
  achievements: number;
  score: number;
  rankKey: string;
  hasNext: boolean;
  /** Present only when this ends the whole life (not a mid-chain stage clear). */
  lineage?: GameOverLineage;
}

export function GameOver({
  info,
  onNext,
  onMenu,
}: {
  info: GameOverInfo;
  onNext: () => void;
  onMenu: () => void;
}) {
  const { t } = useI18n();
  const { boundKeyboard } = useKeyboard();

  // The dialog must be operable without a mouse: Enter/1 confirms the primary
  // action, Esc/2 returns to the menu.
  useEffect(() => {
    const un = boundKeyboard(["return", "1"], () => {
      if (info.hasNext) onNext();
      else onMenu();
    });
    const um = boundKeyboard(["escape", "2", "q"], () => onMenu());
    // [R] opens the full biography / life review.
    const ur = boundKeyboard(["r", "R"], () =>
      presentModal("life-review", LifeReview, { reason: info.reason }),
    );
    return () => {
      un();
      um();
      ur();
    };
  }, [boundKeyboard, info.hasNext, info.reason, onNext, onMenu]);

  const title =
    info.reason === "death"
      ? t("gameover.death")
      : info.hasNext
        ? t("gameover.stageComplete")
        : t("gameover.complete");

  return (
    <ModalFrame width={64} title={title} borderColor="magenta" draggable>
      <Box flexDirection="column">
        <Text color="white">
          {t("gameover.summary", {
            name: info.playerName,
            age: info.age,
          })}
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">
            {t("gameover.money")}: ${info.money}
          </Text>
          <Text color="green">
            {t("gameover.achievements")}: {info.achievements}
          </Text>
          <Text color="cyan">
            {t("gameover.rank")}: {t(info.rankKey)} ({info.score})
          </Text>
        </Box>

        {info.lineage ? (
          <Box
            marginTop={1}
            flexDirection="column"
            borderStyle="round"
            borderColor="magenta"
            paddingX={1}
          >
            <Text bold color="magenta">
              {t("gameover.lineage.title")}
            </Text>
            <Text dimColor>
              {t("gameover.lineage.ended", { n: info.lineage.endedGeneration })}{" "}
              {"→ "}
              {t("gameover.lineage.next", { n: info.lineage.nextGeneration })}
            </Text>
            <Text color="cyan">
              {t("gameover.lineage.epithet", {
                epithet: t(info.lineage.epithetKey),
              })}
            </Text>
            {info.lineage.inheritedMoney > 0 ||
            info.lineage.inheritedStats.length > 0 ? (
              <>
                <Text color="yellow">
                  {t("gameover.lineage.inherit")}
                </Text>
                {info.lineage.inheritedMoney > 0 ? (
                  <Text color="yellow">
                    {"  "}
                    {t("gameover.lineage.money", {
                      n: info.lineage.inheritedMoney,
                    })}
                  </Text>
                ) : null}
                {info.lineage.inheritedStats.length > 0 ? (
                  <Text color="green">
                    {"  "}
                    {t("gameover.lineage.stats")}:{" "}
                    {info.lineage.inheritedStats
                      .map(
                        (s) => `${t(`playerConfig.attr.${s.key}`)} +${s.value}`,
                      )
                      .join("  ")}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text dimColor>{t("gameover.lineage.none")}</Text>
            )}
          </Box>
        ) : null}

        <Box marginTop={1} flexDirection="row" gap={1}>
          {info.hasNext ? (
            <Button label={t("gameover.next")} onPress={onNext} />
          ) : null}
          <Button label={t("gameover.menu")} onPress={onMenu} />
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{t("gameover.keyHint")}</Text>
          <Text dimColor>[R] {t("review.title")}</Text>
        </Box>
      </Box>
    </ModalFrame>
  );
}
