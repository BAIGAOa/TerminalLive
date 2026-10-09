import { useSyncExternalStore, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { container } from "../Container.js";
import ConsoleStore, {
  ConsoleNotification,
  ConsoleCommandResult,
} from "../core/console/ConsoleStore.js";
import ReplRegistry from "../core/repl/ReplRegistry.js";
import ReplRunner from "../core/repl/ReplRunner.js";
import ReplHistory from "../core/repl/ReplHistory.js";
import {
  NO_COMPLETION,
  applyCompletion,
  complete,
} from "../core/repl/ReplCompleter.js";
import {
  CommandDescription,
  describeCommand,
} from "../core/repl/ReplDescribe.js";
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
  /** Index of the highlighted candidate within `completions`. */
  completionIndex: number;
  /** Help for the highlighted candidate (or the typed command). */
  description: CommandDescription | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  enterInputMode: () => void;
  exitInputMode: () => void;
  setInputText: (text: string) => void;
  submitCommand: () => void;
  /** Enter: complete the highlighted candidate, or run the command once the
   *  line is already complete. */
  submitOrComplete: () => void;
  clearResults: () => void;
  /** Tab: complete the current token to the highlighted candidate. */
  acceptCompletion: () => void;
  /** ↑ / ↓: move the highlight through the completion menu. */
  completionPrev: () => void;
  completionNext: () => void;
  /** ↑ / ↓ when there is nothing to complete: walk the command history. */
  historyPrev: () => void;
  historyNext: () => void;
}

export function useControlConsole(): ControlConsoleData {
  const { t } = useI18n();
  const store = container.resolve(ConsoleStore);
  const runner = container.resolve(ReplRunner);
  const registry = container.resolve(ReplRegistry);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  // The completion highlight lives here rather than in the store: walking it
  // changes nothing the store owns, and ↑/↓ must re-render without echoing.
  const [completionIndexRaw, setCompletionIndexRaw] = useState(0);

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

  // Editing the line invalidates the highlight, so it snaps back to the first
  // candidate — but ↑/↓ move it without touching the text.
  const setInputText = useCallback(
    (text: string) => {
      setCompletionIndexRaw(0);
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
    setInputText("");
  }, [snapshot.inputText, store, runner, sink, setInputText]);

  const clearResults = useCallback(() => {
    store.clearCommandResults();
  }, [store]);

  const historyRef = useRef(new ReplHistory());
  // Every candidate, not just the visible slice: the menu windows this list and
  // ↑/↓ must reach past the first screenful.
  const completion = useMemo(
    () =>
      snapshot.inputText.trim()
        ? complete(snapshot.inputText, registry)
        : NO_COMPLETION,
    [snapshot.inputText, registry],
  );
  const completions = completion.candidates;

  const completionIndex = Math.min(completionIndexRaw, Math.max(0, completions.length - 1));

  const moveCompletion = useCallback(
    (delta: number) => {
      setCompletionIndexRaw((i) => {
        const n = completions.length;
        if (n === 0) return 0;
        return (Math.min(i, n - 1) + delta + n) % n;
      });
    },
    [completions.length],
  );

  const completionPrev = useCallback(() => moveCompletion(-1), [moveCompletion]);
  const completionNext = useCallback(() => moveCompletion(1), [moveCompletion]);

  const acceptCompletion = useCallback(() => {
    const text = snapshot.inputText;
    const { candidates } = complete(text, registry);
    if (candidates.length === 0) return;
    // The menu is the thing the user is looking at, so Tab takes the
    // highlighted entry and only falls back to the first candidate when the
    // highlighted one is not in the menu.
    const chosen = completions[completionIndex] ?? candidates[0];
    setCompletionIndexRaw(0);
    store.setInputText(applyCompletion(text, [chosen]));
  }, [snapshot.inputText, registry, store, completions, completionIndex]);

  // Enter completes as well as runs: it fills in the highlighted candidate
  // while that still changes the line, and only runs the command once
  // completing is a no-op — so a fully-typed command still executes on the
  // first Enter, and no half-typed prefix can run something by accident.
  const submitOrComplete = useCallback(() => {
    const text = snapshot.inputText;
    const { candidates } = complete(text, registry);
    const chosen = completions[completionIndex] ?? candidates[0];
    if (chosen) {
      const completed = applyCompletion(text, [chosen]);
      if (completed !== text) {
        setInputText(completed);
        return;
      }
    }
    submitCommand();
  }, [
    snapshot.inputText,
    registry,
    completions,
    completionIndex,
    setInputText,
    submitCommand,
  ]);

  const description = useMemo(
    () =>
      describeCommand(
        snapshot.inputText,
        completions,
        completionIndex,
        registry,
        t,
        completion.details,
      ),
    [snapshot.inputText, completions, completionIndex, registry, t, completion],
  );

  const historyPrev = useCallback(() => {
    const prev = historyRef.current.prev();
    if (prev !== null) setInputText(prev);
  }, [setInputText]);

  const historyNext = useCallback(() => {
    setInputText(historyRef.current.next() ?? "");
  }, [setInputText]);

  return {
    visible: snapshot.visible,
    notifications: snapshot.notifications,
    commandResults: snapshot.commandResults,
    inputMode: snapshot.inputMode,
    inputText: snapshot.inputText,
    unreadCount: snapshot.unreadCount,
    completions,
    completionIndex,
    description,
    t,
    enterInputMode,
    exitInputMode,
    setInputText,
    submitCommand,
    submitOrComplete,
    clearResults,
    acceptCompletion,
    completionPrev,
    completionNext,
    historyPrev,
    historyNext,
  };
}
