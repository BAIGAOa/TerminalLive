import { useSyncExternalStore, useCallback } from "react";
import { container } from "../Container.js";
import ConsoleStore, {
  ConsoleNotification,
  ConsoleCommandResult,
} from "../core/console/ConsoleStore.js";
import ConsoleCommandParser from "../core/console/ConsoleCommandParser.js";
import { useI18n } from "../core/language/LanguageContext.js";

export interface ControlConsoleData {
  visible: boolean;
  notifications: readonly ConsoleNotification[];
  commandResults: readonly ConsoleCommandResult[];
  inputMode: boolean;
  inputText: string;
  unreadCount: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  enterInputMode: () => void;
  exitInputMode: () => void;
  setInputText: (text: string) => void;
  submitCommand: () => void;
  clearResults: () => void;
}

export function useControlConsole(): ControlConsoleData {
  const { t } = useI18n();
  const store = container.resolve(ConsoleStore);
  const parser = container.resolve(ConsoleCommandParser);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  const enterInputMode = useCallback(() => {
    store.enterInputMode();
  }, [store]);

  const exitInputMode = useCallback(() => {
    store.exitInputMode();
  }, [store]);

  const setInputText = useCallback(
    (text: string) => {
      store.setInputText(text);
    },
    [store],
  );

  const submitCommand = useCallback(() => {
    const text = snapshot.inputText;
    if (!text.trim()) return;
    // 先添加一条 info 记录表示用户输入了什么
    store.addCommandResult({
      type: "info",
      message: `> ${text}`,
    });
    parser.load(text);
    store.setInputText("");
  }, [snapshot.inputText, store, parser]);

  const clearResults = useCallback(() => {
    store.clearCommandResults();
  }, [store]);

  return {
    visible: snapshot.visible,
    notifications: snapshot.notifications,
    commandResults: snapshot.commandResults,
    inputMode: snapshot.inputMode,
    inputText: snapshot.inputText,
    unreadCount: snapshot.unreadCount,
    t,
    enterInputMode,
    exitInputMode,
    setInputText,
    submitCommand,
    clearResults,
  };
}