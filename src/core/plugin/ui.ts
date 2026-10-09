/**
 * UI slots — how "everything is a plugin" reaches the screen.
 *
 * A screen or panel the game renders is published under a named slot. Plugins
 * provide an implementation for that slot, and the highest priority wins; with
 * no provider, the game's own implementation renders. Replacing the main menu,
 * a settings page or an in-game panel is therefore the same operation as
 * extending anything else — no patching, no forks.
 *
 * The registry is React-free on purpose: components are opaque values here, and
 * the UI layer wraps them (see `ui/slots/ScreenSlot.tsx`). It notifies
 * subscribers so a hot reload swaps the screen without a restart.
 */

/** Screen slots the game publishes. Plugins target these ids. */
export const SCREEN_SLOTS = {
  mainMenu: "screen.main-menu",
  worldSelection: "screen.world-selection",
  worldGame: "screen.world-game",
  settings: "screen.settings",
} as const;

export type ScreenSlotId = (typeof SCREEN_SLOTS)[keyof typeof SCREEN_SLOTS];

export interface UiRegistration<T> {
  /** Opaque to the kernel — a component, for every slot we ship. */
  value: T;
  owner: string;
  priority: number;
  /** Monotonic sequence, so equal priorities resolve to the newest. */
  seq: number;
}

/** Which plugin provides what, for every named UI slot. */
export class UiSlotRegistry {
  private slots = new Map<string, UiRegistration<unknown>[]>();
  private seq = 0;
  private version = 0;
  private listeners = new Set<() => void>();

  /** Publish (or replace) this plugin's implementation of `slot`. */
  public provide<T>(
    slot: string,
    value: T,
    owner: string,
    priority = 0,
  ): void {
    const list = (this.slots.get(slot) ?? []).filter((r) => r.owner !== owner);
    list.push({ value, owner, priority, seq: ++this.seq });
    this.slots.set(slot, list);
    this.notify();
  }

  /** The implementation to render: highest priority, newest on a tie. */
  public resolve<T>(slot: string): T | undefined {
    const best = this.best(slot);
    return best?.value as T | undefined;
  }

  /** Who currently wins the slot, or undefined when nobody provides it. */
  public best(slot: string): UiRegistration<unknown> | undefined {
    const list = this.slots.get(slot);
    if (!list?.length) return undefined;
    return list.reduce((a, b) =>
      b.priority > a.priority || (b.priority === a.priority && b.seq > a.seq)
        ? b
        : a,
    );
  }

  /** Every registration for a slot, best first. */
  public list(slot: string): UiRegistration<unknown>[] {
    return [...(this.slots.get(slot) ?? [])].sort((a, b) =>
      b.priority - a.priority || b.seq - a.seq,
    );
  }

  /** Drop everything a plugin provided (unload, hot reload). */
  public clearOwner(owner: string): void {
    let changed = false;
    for (const [slot, list] of this.slots) {
      const next = list.filter((r) => r.owner !== owner);
      if (next.length === list.length) continue;
      changed = true;
      if (next.length) this.slots.set(slot, next);
      else this.slots.delete(slot);
    }
    if (changed) this.notify();
  }

  public slotIds(): string[] {
    return [...this.slots.keys()];
  }

  // ── reactivity (useSyncExternalStore) ─────────────────────────
  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): number => this.version;

  private notify(): void {
    this.version++;
    for (const fn of [...this.listeners]) fn();
  }
}
