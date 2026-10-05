import { useSyncExternalStore, useCallback, useEffect, useMemo, useRef } from "react";
import { container } from "../Container.js";
import ConsoleStore, {
  ConsoleNotification,
  ConsoleCommandResult,
} from "../core/console/ConsoleStore.js";
import ReplRegistry from "../core/repl/ReplRegistry.js";
import ReplRunner from "../core/repl/ReplRunner.js";
import ReplHistory from "../core/repl/ReplHistory.js";
import { applyCompletion, complete } from "../core/repl/ReplCompleter.js";
import { registerReplCommands } from "../core/repl/commands/index.js";
import { ReplSink } from "../core/repl/types.js";
import { useI18n } from "../core/language/LanguageContext.js";
import { dismissModal } from "../ui/layers/modalBus.js";
import { CONSOLE_LAYER_ID } from "../ui/layers/layerIds.js";

export interface ControlConsoleData {
  visible: boolean;
  notifications: readonly ConsoleNotification[];
  commandResults: readonly ConsoleCommandResult[];
  inputMode: boolean;
  inputText: string;
  unreadCount: number;
  /** Live completion candidates for the current input. */
  completions: string[];
  t: (key: string, params?: Record<string, string | number>) => string;
  enterInputMode: () => void;
  exitInputMode: () => void;
  setInputText: (text: string) => void;
  submitCommand: () => void;
  clearResults: () => void;
  /** Tab: complete the current token to the first candidate. */
  acceptCompletion: () => void;
  /** ↑ / ↓: walk the command history. */
  historyPrev: () => void;
  historyNext: () => void;
}

export function useControlConsole(): ControlConsoleData {
  const { t } = useI18n();
  const store = container.resolve(ConsoleStore);
  const runner = container.resolve(ReplRunner);
  const registry = container.resolve(ReplRegistry);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  // Make the command table available and keep the translator fresh. These are
  // registrations/side effects, so they belong in an effect — not the render
  // phase, where a thrown error or a discarded render would still mutate state.
  useEffect(() => {
    registerReplCommands(registry);
    runner.setTranslator(t);
  }, [registry, runner, t]);

  // Commands print into the console's result list instead of a scrollback.
  const sink: ReplSink = useMemo(
    () => ({
      print: (text, kind) =>
        store.addCommandResult({
          type:
            kind === "error" ? "error" : kind === "success" ? "success" : "info",
          message: text,
        }),
      clear: () => store.clearCommandResults(),
      // `close` must hide the console *and* dismiss its modal layer — the store
      // flag alone leaves the (now hidden) layer on screen.
      close: () => {
        dismissModal(CONSOLE_LAYER_ID);
        if (store.getSnapshot().visible) store.toggle();
      },
    }),
    [store],
  );

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
    historyRef.current.push(text);
    store.addCommandResult({ type: "info", message: `> ${text}` });
    // echo:false — we just echoed the input ourselves.
    runner.execute(text, { sink, echo: false });
    store.setInputText("");
  }, [snapshot.inputText, store, runner, sink]);

  const clearResults = useCallback(() => {
    store.clearCommandResults();
  }, [store]);

  const historyRef = useRef(new ReplHistory());
  const completions = useMemo(
    () =>
      snapshot.inputText.trim()
        ? complete(snapshot.inputText, registry).candidates.slice(0, 4)
        : [],
    [snapshot.inputText, registry],
  );

  const acceptCompletion = useCallback(() => {
    const text = snapshot.inputText;
    const { candidates } = complete(text, registry);
    if (candidates.length === 0) return;
    store.setInputText(applyCompletion(text, candidates));
  }, [snapshot.inputText, registry, store]);

  const historyPrev = useCallback(() => {
    const prev = historyRef.current.prev();
    if (prev !== null) store.setInputText(prev);
  }, [store]);

  const historyNext = useCallback(() => {
    store.setInputText(historyRef.current.next() ?? "");
  }, [store]);

  return {
    visible: snapshot.visible,
    notifications: snapshot.notifications,
    commandResults: snapshot.commandResults,
    inputMode: snapshot.inputMode,
    inputText: snapshot.inputText,
    unreadCount: snapshot.unreadCount,
    completions,
    t,
    enterInputMode,
    exitInputMode,
    setInputText,
    submitCommand,
    clearResults,
    acceptCompletion,
    historyPrev,
    historyNext,
  };
}
