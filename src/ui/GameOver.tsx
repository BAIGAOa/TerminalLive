import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useKeyboard } from "ink-cartridge";
import { Button, ModalFrame } from "./kit/index.js";
import { useI18n } from "../core/language/LanguageContext.js";

export interface GameOverInfo {
  reason: "death" | "complete";
  age: number;
  playerName: string;
  money: number;
  achievements: number;
  score: number;
  rankKey: string;
  hasNext: boolean;
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
    return () => {
      un();
      um();
    };
  }, [boundKeyboard, info.hasNext, onNext, onMenu]);

  const title =
    info.reason === "death"
      ? t("gameover.death")
      : info.hasNext
        ? t("gameover.stageComplete")
        : t("gameover.complete");

  return (
    <ModalFrame width={56} title={title} borderColor="magenta" draggable>
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

        <Box marginTop={1} flexDirection="row" gap={1}>
          {info.hasNext ? (
            <Button label={t("gameover.next")} onPress={onNext} />
          ) : null}
          <Button label={t("gameover.menu")} onPress={onMenu} />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{t("gameover.keyHint")}</Text>
        </Box>
      </Box>
    </ModalFrame>
  );
}
