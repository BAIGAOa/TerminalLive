import React, { useMemo, useEffect } from 'react';
import { Box, Text } from 'ink';
import { SelectInput, useKeyboard, useScreenSystem } from '@baigao_h/ink-kit';
import type { Item } from '@baigao_h/ink-kit';
import { useAchievementScreen } from '../hooks/useAchievementScreen.js';
import { useThemeColors } from '../hooks/theme/ThematicCommunicator.js';
import { MergedAchievement } from '../achievement/AchievementManager.js';

const AchievementCard = ({
  achievement,
  t,
}: {
  achievement: MergedAchievement;
  t: (key: string, params?: Record<string, string | number>) => string;
}) => {
  const colors = useThemeColors();
  const isUnlocked = achievement.unlocked;

  if (!isUnlocked && achievement.hidden) {
    return (
      <Box
        width="100%"
        borderStyle="round"
        borderColor={colors.muted}
        paddingX={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text color={colors.muted} bold>???</Text>
          <Text dimColor>{t('achievement.hidden')}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      width="100%"
      borderStyle="round"
      borderColor={isUnlocked ? colors.achievement : colors.achievementLocked}
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="column">
        <Text color={isUnlocked ? colors.achievement : colors.achievementLocked} bold>
          {isUnlocked ? '✓' : '○'} {t(achievement.nameKey)}
        </Text>
        <Text dimColor={!isUnlocked}>
          {t(achievement.descriptionKey)}
        </Text>
        {isUnlocked && achievement.unlockedAt !== null && (
          <Text dimColor>
            {t('achievement.unlockedAt', { age: achievement.unlockedAt })}
          </Text>
        )}
      </Box>
    </Box>
  );
};

function CategoryItem({ label, isSelected }: { label: string; value: string; isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box
      borderStyle="double"
      width="100%"
      height={4}
      borderColor={isSelected ? colors.highlight : colors.muted}
    >
      <Box justifyContent="center" width="100%" height={4}>
        <Text bold>{label}</Text>
      </Box>
    </Box>
  );
}

function DefaultIndicator({ isSelected }: { isSelected: boolean }) {
  const colors = useThemeColors();
  return (
    <Box marginRight={1}>
      <Text color={isSelected ? colors.highlight : undefined}>
        {isSelected ? '❯' : ' '}
      </Text>
    </Box>
  );
}

export default function AchievementScreen() {
  const data = useAchievementScreen();
  const colors = useThemeColors();
  const { boundKeyboard } = useKeyboard();
  const { back } = useScreenSystem();

  useEffect(() => {
    const u = boundKeyboard(["escape"], () => back());
    return () => u();
  }, [back, boundKeyboard]);

  const categoryItems: Item<string>[] = useMemo(
    () =>
      data.menuItems.map((m) => ({
        label: m.label,
        value: m.value,
      })),
    [data.menuItems],
  );

  return (
    <Box flexDirection="column" width="100%" height={data.rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.menuTitle} bold>
          {data.t('achievement.title', {
            unlocked: data.totalUnlocked,
            total: data.allAchievements.length,
          })}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1} height="100%">
        <Box borderStyle="bold" width="30%">
          <SelectInput
            items={categoryItems}
            onSelect={(item) => {
              const cat = data.menuItems.find((m) => m.value === item.value);
              if (cat) data.onSelectCategory(cat);
            }}
            focusId="achievement-category"
            itemComponent={CategoryItem as any}
            indicatorComponent={DefaultIndicator}
          />
        </Box>

        <Box
          flexDirection="column"
          padding={1}
          width="70%"
          borderStyle="single"
          borderColor={colors.info}
        >
          <Box marginBottom={1}>
            <Text dimColor>
              {data.t('achievement.categoryCount', {
                category: data.t(`achievement.category.${data.activeCategory}`),
                unlocked: data.categoryUnlocked,
                total: data.filteredAchievements.length,
              })}
            </Text>
          </Box>

          {data.filteredAchievements.length === 0 ? (
            <Text dimColor>{data.t('achievement.empty')}</Text>
          ) : (
            data.filteredAchievements.map(a => (
              <AchievementCard key={a.id} achievement={a} t={data.t} />
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}