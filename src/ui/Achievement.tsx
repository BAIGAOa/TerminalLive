import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { Achievement } from '../achievement/Achievement.js';
import { useAchievementScreen, CategoryMenuItem } from '../hooks/useAchievementScreen.js';


const CategoryMenuBox = (props: CategoryMenuItem & { isSelected?: boolean }) => (
  <Box
    borderStyle="double"
    width="100%"
    height={4}
    borderColor={props.isSelected ? 'blue' : 'gray'}
  >
    <Box justifyContent="center" width="100%" height={4}>
      <Text bold>{props.label}</Text>
    </Box>
  </Box>
);

const AchievementCard = ({
  achievement,
  t,
}: {
  achievement: Achievement;
  t: (key: string, params?: Record<string, string | number>) => string;
}) => {
  const isUnlocked = achievement.unlocked;

  if (!isUnlocked && achievement.hidden) {
    return (
      <Box
        width="100%"
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text color="gray" bold>???</Text>
          <Text dimColor>{t('achievement.hidden')}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      width="100%"
      borderStyle="round"
      borderColor={isUnlocked ? 'green' : 'gray'}
      paddingX={1}
      marginBottom={1}
    >
      <Box flexDirection="column">
        <Text color={isUnlocked ? 'green' : 'gray'} bold>
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


export default function AchievementScreen() {
  const data = useAchievementScreen();

  return (
    <Box flexDirection="column" width="100%" height={data.rows}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color="yellow" bold>
          {data.t('achievement.title', {
            unlocked: data.totalUnlocked,
            total: data.allAchievements.length,
          })}
        </Text>
      </Box>

      <Box flexDirection="row" width="100%" flexGrow={1} height="100%">
        <Box borderStyle="bold" width="30%">
          <SelectInput
            items={data.menuItems}
            onSelect={data.onSelectCategory as any}
            itemComponent={CategoryMenuBox as any}
          />
        </Box>

        <Box
          flexDirection="column"
          padding={1}
          width="70%"
          borderStyle="single"
          borderColor="cyan"
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