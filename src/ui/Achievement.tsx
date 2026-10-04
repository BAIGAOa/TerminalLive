import React, { useEffect, useMemo } from "react";
import { Box, Text } from "ink";
import { useKeyboard, useScreenSystem } from "ink-cartridge";
import { MenuList, ScrollList } from "./kit/index.js";
import { useAchievementScreen } from "../hooks/useAchievementScreen.js";
import { useThemeColors } from "../hooks/theme/ThematicCommunicator.js";
import { MergedAchievement } from "../achievement/AchievementManager.js";

/** Every card is exactly this many lines: top border, title, desc, bottom border. */
const CARD_HEIGHT = 4;

function AchievementCard({
  achievement,
  selected,
  t,
  colors,
}: {
  achievement: MergedAchievement;
  selected: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const isUnlocked = achievement.unlocked;
  const hidden = !isUnlocked && achievement.hidden;

  const accent = hidden
    ? colors.muted
    : isUnlocked
      ? colors.achievement
      : colors.achievementLocked;

  return (
    <Box
      height={CARD_HEIGHT}
      borderStyle="round"
      borderColor={selected ? colors.highlight : accent}
      paddingX={1}
      flexDirection="column"
    >
      <Box flexDirection="row" justifyContent="space-between" width="100%">
        <Text bold color={isUnlocked ? colors.achievement : accent}>
          {hidden ? "???" : `${isUnlocked ? "✓" : "○"} ${t(achievement.nameKey)}`}
        </Text>
        {isUnlocked && achievement.unlockedAt !== null ? (
          <Text dimColor>
            {t("achievement.unlockedAt", { age: achievement.unlockedAt })}
          </Text>
        ) : null}
      </Box>
      <Text dimColor={!isUnlocked} wrap="truncate">
        {hidden ? t("achievement.hidden") : t(achievement.descriptionKey)}
      </Text>
    </Box>
  );
}

export default function AchievementScreen() {
  const data = useAchievementScreen();
  const colors = useThemeColors();
  const { boundKeyboard, focusSet } = useKeyboard();
  const { back } = useScreenSystem();

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => back());
    return () => u();
  }, [back, boundKeyboard]);

  // Defer: the new category's card list mounts on the next render, so the
  // focus target may not be registered yet if we move focus synchronously.
  const focusCards = () => {
    setTimeout(() => {
      try {
        focusSet("achievement-list");
      } catch {
        /* not registered yet */
      }
    }, 0);
  };

  const catItems = data.menuItems.map((m) => ({
    value: m.value,
    label: m.label,
  }));

  const byId = useMemo(() => {
    const map = new Map<string, MergedAchievement>();
    for (const a of data.filteredAchievements) map.set(a.id, a);
    return map;
  }, [data.filteredAchievements]);

  const cardItems = data.filteredAchievements.map((a) => ({
    value: a.id,
    label: a.nameKey,
  }));

  return (
    <Box flexDirection="column" width="100%" height={data.rows} padding={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {data.t("achievement.title", {
            unlocked: data.totalUnlocked,
            total: data.allAchievements.length,
          })}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1}>
        <Box width="28%" marginRight={1}>
          <MenuList
            focusId="achievement-category"
            items={catItems}
            onSelect={(item) => {
              const cat = data.menuItems.find((m) => m.value === item.value);
              if (cat) data.onSelectCategory(cat);
              focusCards();
            }}
            renderItem={(item, state) => (
              <Box
                borderStyle="double"
                borderColor={state.selected ? colors.highlight : colors.muted}
                paddingX={1}
                justifyContent="center"
              >
                <Text bold={state.selected}>{item.label}</Text>
              </Box>
            )}
          />
        </Box>

        <Box
          flexDirection="column"
          width="72%"
          borderStyle="single"
          borderColor={colors.info}
          paddingX={1}
        >
          <Box marginBottom={1}>
            <Text dimColor>
              {data.t("achievement.categoryCount", {
                category: data.t(`achievement.category.${data.activeCategory}`),
                unlocked: data.categoryUnlocked,
                total: data.filteredAchievements.length,
              })}
            </Text>
          </Box>
          {data.filteredAchievements.length === 0 ? (
            <Text dimColor>{data.t("achievement.empty")}</Text>
          ) : (
            <ScrollList
              focusId="achievement-list"
              itemHeight={CARD_HEIGHT}
              height={Math.max(CARD_HEIGHT, data.rows - data.menuItems.length - 6)}
              items={cardItems}
              renderItem={(item, state) => {
                const a = byId.get(item.value);
                if (!a) return <Box height={CARD_HEIGHT} />;
                return (
                  <AchievementCard
                    achievement={a}
                    selected={state.selected}
                    t={data.t}
                    colors={colors}
                  />
                );
              }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
