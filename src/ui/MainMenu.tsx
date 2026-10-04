import React, { useCallback } from "react";
import { Box, Text } from "ink";
import { gotoScreen, useScreenSystem } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import Logo from "./Logo.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import { computeMenuLayout } from "./menuLayout.js";
import { container } from "../Container.js";
import LevelManager from "../level/LevelManager.js";
import LevelSelection from "./LevelSelection.js";
import LevelGame from "./LevelGame.js";
import Setting from "./Setting.js";
import Language from "./Language.js";
import AchievementScreen from "./Achievement.js";
import Archive from "./Archive.js";
import Traits from "./Traits.js";
import Shop from "./Shop.js";
import Codex from "./Codex.js";

export default function MainMenu() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { skip } = useScreenSystem();
  const { columns: termCols, rows: termRows } = useTerminalSize();

  const hasActiveLife = container.resolve(LevelManager).hasActiveLevel();

  // Responsive grid: buttons stay a uniform width and fan out into fewer
  // columns (3 → 2 → 1) as the terminal narrows, staying centered and on-screen.
  const GAP = 2;

  const items = [
    ...(hasActiveLife
      ? [{ value: "continue", label: t("main.continue") }]
      : []),
    { value: "start", label: t("main.startGame") },
    { value: "traits", label: t("main.traits") },
    { value: "shop", label: t("main.shop") },
    { value: "codex", label: t("main.codex") },
    { value: "config", label: t("main.enterConfig") },
    { value: "language", label: t("main.configurationLanguage") },
    { value: "achievement", label: t("main.achievement") },
    { value: "archive", label: t("main.archive") },
    { value: "exit", label: t("main.exit") },
  ];

  const { cols, btnW, showLogo } = computeMenuLayout(
    termCols,
    termRows,
    items.length,
  );

  const handleSelect = useCallback(
    (item: { value: string }) => {
      switch (item.value) {
        case "continue":
          gotoScreen(LevelGame, {});
          break;
        case "start":
          skip(LevelSelection, {});
          break;
        case "traits":
          skip(Traits, {});
          break;
        case "shop":
          skip(Shop, {});
          break;
        case "codex":
          skip(Codex, {});
          break;
        case "config":
          skip(Setting, {});
          break;
        case "language":
          skip(Language, {});
          break;
        case "achievement":
          skip(AchievementScreen, {});
          break;
        case "archive":
          skip(Archive, {});
          break;
        case "exit":
          process.exit(0);
      }
    },
    [skip],
  );

  return (
    <Box
      width="100%"
      height="100%"
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
      padding={1}
    >
      {showLogo ? (
        <Logo marginBottom={2} />
      ) : (
        <Box marginBottom={1}>
          <Text bold color={colors.logoTerm}>
            TERMINAL LIVE
          </Text>
        </Box>
      )}
      <MenuList
        focusId="main-menu"
        items={items}
        onSelect={handleSelect}
        columns={cols}
        columnWidth={btnW}
        colGap={GAP}
        rowGap={0}
        indicator={null}
        renderItem={(item, state) => (
          <Box
            flexGrow={1}
            borderStyle="round"
           
            borderColor={state.selected ? colors.highlight : colors.muted}
            paddingX={1}
            justifyContent="center"
          >
            <Text
              bold={state.selected}
              color={state.selected ? colors.highlight : colors.text}
            >
              {item.label}
            </Text>
          </Box>
        )}
      />
    </Box>
  );
}
