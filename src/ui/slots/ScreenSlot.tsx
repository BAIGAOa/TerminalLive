import React, { useSyncExternalStore } from "react";
import { container } from "../../Container.js";
import { UiSlotRegistry } from "../../core/plugin/ui.js";

/**
 * Turn a screen into a *slot*: a stable component the screen tree navigates to,
 * which renders whatever plugin currently owns that slot — or the game's own
 * implementation when nobody does.
 *
 * The wrapper has to be a distinct component per slot, because ink-cartridge
 * keys the screen tree by component identity. That is exactly what makes this
 * work: navigation keeps pointing at the wrapper while the implementation
 * behind it is swapped by a plugin, at boot or on hot reload.
 */

/**
 * What a takeover of this screen receives as `props.data`.
 *
 * A plugin replacing a screen needs the same things the built-in one reads:
 * the player, the year, the actions on offer. That data is produced by the
 * game's own hooks, which a plugin cannot call, so the slot measures it and
 * hands over plain values — the presentation half is the plugin's, the
 * view-model stays the game's.
 */
export type ScreenViewModel = () => unknown;

export function makeScreenSlot(
  slot: string,
  /**
   * The built-in screen, resolved lazily. Screens navigate to each other, so
   * the module that builds these slots is necessarily in an import cycle with
   * them — reading the binding at module-eval time would depend on which entry
   * loaded first. A thunk defers it to the first render, when everything is up.
   */
  fallback: () => React.ComponentType<any>,
  /** The screen's view-model, as a hook. Called only when a plugin owns it. */
  useViewModel?: ScreenViewModel,
): React.ComponentType<any> {
  /** A plugin-owned screen, given the view-model the game measured for it. */
  function ProvidedScreen({ Impl, navProps }: { Impl: React.ComponentType<any>; navProps: Record<string, unknown> }) {
    // Unconditional within this component: the slot's view-model is fixed when
    // the slot is built, so the hook order never changes.
    const data = useViewModel ? useViewModel() : undefined;
    return React.createElement(Impl, { ...navProps, data });
  }

  function ScreenSlot(props: Record<string, unknown>) {
    const registry = container.resolve(UiSlotRegistry);
    // Re-render when a plugin takes the slot over (or gives it back).
    useSyncExternalStore(registry.subscribe, registry.getSnapshot);
    const Provided = registry.resolve<React.ComponentType<any>>(slot);
    if (!Provided) return React.createElement(fallback(), props);
    return React.createElement(ProvidedScreen, { Impl: Provided, navProps: props });
  }
  ScreenSlot.displayName = `ScreenSlot(${slot})`;
  return ScreenSlot;
}
