import type { TranslateFn } from "../repl/types.js";

/**
 * The active translator, reachable without React.
 *
 * Translation normally lives in a React context, which is fine for screens but
 * useless to a plugin running in a hook or a console command. The provider
 * installs its `t` here on mount; anything that is not a component reads it
 * back. Until then it is the identity function, so a call before the provider
 * mounts returns the key rather than throwing.
 */
let current: TranslateFn = (key) => key;

export function installTranslator(t: TranslateFn): void {
  current = t;
}

/** Translate a key with the language the player has selected. */
export function translate(key: string, params?: Record<string, string | number>): string {
  return current(key, params);
}
