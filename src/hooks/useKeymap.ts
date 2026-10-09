import { useMemo, useSyncExternalStore } from "react";
import { container } from "../Container.js";
import ConfigStore from "../core/store/ConfigStore.js";
import KeyActionRegistry, {
  type KeyAction,
} from "../core/registry/KeyActionRegistry.js";
import { resolveKeymap } from "../ui/keymap.js";

/**
 * The player's key bindings, plus the actions they apply to.
 *
 * Memoised on purpose. A screen that recomputed the map inline got a fresh
 * object every render, and any effect listing it as a dependency unbound and
 * rebound all of its handlers on every keystroke-sized re-render — a keyboard
 * press landing in that gap is simply dropped.
 */
export function useKeymap(): {
  keymap: Record<string, string>;
  actions: KeyAction[];
} {
  const configStore = container.resolve(ConfigStore);
  const registry = container.resolve(KeyActionRegistry);

  const savedJson = useSyncExternalStore(configStore.subscribe, () =>
    JSON.stringify(configStore.getKeyBindings()),
  );
  const saved = useMemo(
    () => JSON.parse(savedJson) as Record<string, string>,
    [savedJson],
  );

  // The registry hands out a fresh array each call, so the memo keys off the
  // ids instead: a plugin that adds a shortcut still refreshes this.
  const actionIds = registry.effective().map((a) => a.id).join("|");
  const actions = useMemo(
    () => registry.effective(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registry, actionIds],
  );

  const keymap = useMemo(() => resolveKeymap(saved, actions), [saved, actions]);
  return { keymap, actions };
}
