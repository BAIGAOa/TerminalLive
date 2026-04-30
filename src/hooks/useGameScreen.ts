import { useSyncExternalStore, useMemo, useCallback } from 'react';
import { container } from '../Container.js';
import Player from '../world/Player.js';
import LogStore from '../core/store/LogStore.js';
import GameViewStore from '../core/store/GameViewStore.js';
import { GameViveModes } from '../types/GameViveModeType.js';
import { useI18n } from '../core/language/LanguageContext.js';
import { useTerminalSize } from '../ui/TerminalSizeContext.js';

export interface GameScreenData {
  player: Player;
  logs: ReturnType<LogStore['getSnapshot']>;
  viewMode: GameViveModes;
  viewModes: GameViveModes[];
  rows: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  langCode: string;
  onChangeView: (mode: GameViveModes) => void;
}

export function useGameScreen(player: Player): GameScreenData {
  const { t, langCode } = useI18n();
  const { rows } = useTerminalSize();

  const logStore = container.resolve(LogStore);
  const logs = useSyncExternalStore(logStore.subscribe, logStore.getSnapshot);

  const gameViewStore = container.resolve(GameViewStore);
  const viewMode = useSyncExternalStore(gameViewStore.subscribe, gameViewStore.getSnapshot);

  useSyncExternalStore(
    player.subscribe,
    () => `${player.health}-${player.angerValue}-${player.age}-${player.currentStatus}`,
  );

  const viewModes = useMemo(() => Object.values(GameViveModes), []);

  const onChangeView = useCallback(
    (mode: GameViveModes) => gameViewStore.setView(mode),
    [gameViewStore],
  );

  return {
    player,
    logs,
    viewMode,
    viewModes,
    rows,
    t,
    langCode,
    onChangeView,
  };
}