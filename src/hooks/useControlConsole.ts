import { useSyncExternalStore } from 'react';
import { container } from '../Container.js';
import ConsoleStore, { ConsoleNotification } from '../core/console/ConsoleStore.js';
import { useI18n } from '../core/language/LanguageContext.js';

export interface ControlConsoleData {
  notifications: readonly ConsoleNotification[];
  t: (key: string) => string;
}

export function useControlConsole(): ControlConsoleData {
  const { t } = useI18n();
  const store = container.resolve(ConsoleStore);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  return {
    notifications: snapshot.notifications,
    t,
  };
}