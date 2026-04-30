import React from 'react';
import { Box, Text } from 'ink';
import { ConsoleNotification } from '../core/console/ConsoleStore.js';
import { useControlConsole } from '../hooks/useControlConsole.js';

const NotificationItem = ({
  notification,
  t,
}: {
  notification: ConsoleNotification;
  t: (key: string) => string;
}) => {
  switch (notification.type) {
    case 'achievement':
      return (
        <Text color="green">
          ★ {t('achievement.unlock')} {t(notification.messageKey)}
        </Text>
      );
    default:
      return <Text>{t(notification.messageKey)}</Text>;
  }
};

export default function ControlConsole() {
  const { notifications, t } = useControlConsole();

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="redBright"
      width="100%"
      height={10}
      paddingX={1}
      backgroundColor="black"
    >
      <Box justifyContent="space-between">
        <Text color="red" bold>{t('console.title')}</Text>
        <Text dimColor>[P] {t('console.close')}</Text>
      </Box>

      {notifications.length === 0 ? (
        <Text dimColor>{t('console.empty')}</Text>
      ) : (
        notifications.slice(0, 6).map(n => (
          <NotificationItem key={n.id} notification={n} t={t} />
        ))
      )}
    </Box>
  );
}