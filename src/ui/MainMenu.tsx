import React, { useCallback } from "react";
import { Box, Text, useWindowSize } from "ink";
import { gotoScreen, useScreenSystem } from "ink-cartridge";
import { MenuList } from "./kit/index.js";
import Logo from "./Logo.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { computeMenuLayout } from "./menuLayout.js";
import { container } from "../Container.js";
import WorldManager from "../worlds/WorldManager.js";
import LineageStore from "../core/store/LineageStore.js";
import {
  SettingScreen as Setting,
  WorldGameScreen as WorldGame,
  WorldSelectionScreen as WorldSelection,
} from "./slots/screens.js";
import Language from "./Language.js";
import AchievementScreen from "./Achievement.js";
import Archive from "./Archive.js";
import Traits from "./Traits.js";
import Shop from "./Shop.js";
import Codex from "./Codex.js";
import Lineage from "./Lineage.js";

export default function MainMenu() {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { skip } = useScreenSystem();
  const { columns: termCols, rows: termRows } = useWindowSize();

  const hasActiveLife = container.resolve(WorldManager).hasActiveWorld();

  // Responsive grid: buttons stay a uniform width and fan out into fewer
  // columns (3 → 2 → 1) as the terminal narrows, staying centered and on-screen.
  const GAP = 2;

  const items = [
    ...(hasActiveLife
      ? [{ value: "continue", label: t("main.continue") }]
      : []),
    {
      value: "start",
      label: `${t("main.startGame")} · ${t("lineage.genShort", {
        n: container.resolve(LineageStore).getNextGeneration(),
      })}`,
    },
    { value: "traits", label: t("main.traits") },
    { value: "shop", label: t("main.shop") },
    { value: "codex", label: t("main.codex") },
    { value: "lineage", label: t("main.lineage") },
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
          gotoScreen(WorldGame, {});
          break;
        case "start":
          skip(WorldSelection, {});
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
        case "lineage":
          skip(Lineage, {});
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
            borderStyle="bold"
           
            borderColor={state.selected ? colors.highlight : colors.muted}
            paddingX={1}
            justifyContent="center"
          >
            <Text
              bold={state.selected}
              wrap="truncate"
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
