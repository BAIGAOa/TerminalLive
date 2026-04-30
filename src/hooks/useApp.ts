import { useSyncExternalStore } from 'react';
import { container } from '../Container.js';
import HighlightStore from '../core/store/HighlightStore.js';
import ScreenStore from '../core/store/ScreenStore.js';
import ConsoleStore from '../core/console/ConsoleStore.js';
import { useI18n } from '../core/language/LanguageContext.js';
import { Scenes } from '../types/Scenes.js';

export interface AppData {
  highlighting: string | null;
  currentScreen: Scenes;
  consoleVisible: boolean;
  consoleUnreadCount: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useApp(): AppData {
  const { t } = useI18n();

  const highlightStore = container.resolve(HighlightStore);
  const screenStore = container.resolve(ScreenStore);
  const consoleStore = container.resolve(ConsoleStore);

  const highlighting = useSyncExternalStore(highlightStore.subscribe, highlightStore.getSnapshot);
  const currentScreen = useSyncExternalStore(screenStore.subscribe, screenStore.getSnapshot);
  const consoleSnapshot = useSyncExternalStore(consoleStore.subscribe, consoleStore.getSnapshot);

  return {
    highlighting,
    currentScreen,
    consoleVisible: consoleSnapshot.visible,
    consoleUnreadCount: consoleSnapshot.unreadCount,
    t,
  };
}
