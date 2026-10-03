/** Configurable application shortcuts, editable from the Key Binding screen. */
export interface KeyAction {
  id: string;
  labelKey: string;
  defaultKey: string;
}

export const KEY_ACTIONS: KeyAction[] = [
  { id: "console", labelKey: "key.action.console", defaultKey: "p" },
  { id: "help", labelKey: "key.action.help", defaultKey: "?" },
  { id: "menu", labelKey: "key.action.menu", defaultKey: "q" },
  { id: "endTurn", labelKey: "key.action.endTurn", defaultKey: "e" },
];

/** Merge saved bindings over the defaults. An empty string falls back to the
 *  default (a space is a valid key and is kept). */
export function resolveKeymap(
  saved: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const action of KEY_ACTIONS) {
    const savedKey = saved?.[action.id];
    out[action.id] =
      savedKey === undefined || savedKey === "" ? action.defaultKey : savedKey;
  }
  return out;
}
