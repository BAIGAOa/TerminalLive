/**
 * Single-line editing model for {@link TextField} — React-free so every rule
 * (where the caret may sit, what a key does to it) is unit-testable.
 *
 * The caret is a UTF-16 index into the value, kept outside surrogate pairs so
 * moving or deleting never splits an emoji in half.
 */

export interface TextEditState {
  value: string;
  /** Caret index; always within `[0, value.length]` and never mid-surrogate. */
  cursor: number;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** Clamp `cursor` into the value, landing outside any surrogate pair. */
export function clampCursor(value: string, cursor: number): number {
  if (cursor <= 0) return 0;
  if (cursor >= value.length) return value.length;
  // Inside a pair (an external writer truncated the text): snap to its start.
  return isLowSurrogate(value.charCodeAt(cursor)) ? cursor - 1 : cursor;
}

/** One character left — a surrogate pair counts as one. */
export function stepLeft(value: string, cursor: number): number {
  const at = clampCursor(value, cursor);
  if (at === 0) return 0;
  return isLowSurrogate(value.charCodeAt(at - 1)) ? at - 2 : at - 1;
}

/** One character right — a surrogate pair counts as one. */
export function stepRight(value: string, cursor: number): number {
  const at = clampCursor(value, cursor);
  if (at >= value.length) return value.length;
  return isHighSurrogate(value.charCodeAt(at)) ? at + 2 : at + 1;
}

export function caretLeft(state: TextEditState): TextEditState {
  return { value: state.value, cursor: stepLeft(state.value, state.cursor) };
}

export function caretRight(state: TextEditState): TextEditState {
  return { value: state.value, cursor: stepRight(state.value, state.cursor) };
}

export function caretStart(state: TextEditState): TextEditState {
  return { value: state.value, cursor: 0 };
}

export function caretEnd(state: TextEditState): TextEditState {
  return { value: state.value, cursor: state.value.length };
}

/** Insert `text` at the caret, leaving the caret just after it. */
export function insertText(state: TextEditState, text: string): TextEditState {
  const at = clampCursor(state.value, state.cursor);
  return {
    value: state.value.slice(0, at) + text + state.value.slice(at),
    cursor: at + text.length,
  };
}

/** Delete the character before the caret; the caret moves back with it. */
export function backspace(state: TextEditState): TextEditState {
  const at = clampCursor(state.value, state.cursor);
  const from = stepLeft(state.value, at);
  if (from === at) return state;
  return {
    value: state.value.slice(0, from) + state.value.slice(at),
    cursor: from,
  };
}

/** Delete the character at the caret; the caret stays put. */
export function deleteForward(state: TextEditState): TextEditState {
  const at = clampCursor(state.value, state.cursor);
  const to = stepRight(state.value, at);
  if (to === at) return state;
  return {
    value: state.value.slice(0, at) + state.value.slice(to),
    cursor: at,
  };
}

/** Empty the line. Takes the state only so every key handler has one shape. */
export function clear(_state: TextEditState): TextEditState {
  return { value: "", cursor: 0 };
}

/**
 * Where a caret index into the value lands in the *masked* rendering.
 *
 * A mask replaces each input character with a (possibly multi-unit) character,
 * so the caret cannot be used as an index into the masked string directly. The
 * value's caret counts code units; the mask counts characters.
 */
export function maskedCursor(
  value: string,
  cursor: number,
  maskChar: string,
): number {
  if (!maskChar) return cursor;
  const chars = [...value.slice(0, clampCursor(value, cursor))].length;
  return chars * maskChar.length;
}

/** The value split around the caret, for rendering text either side of it. */
export function splitAtCaret(state: TextEditState): {
  before: string;
  after: string;
} {
  const at = clampCursor(state.value, state.cursor);
  return { before: state.value.slice(0, at), after: state.value.slice(at) };
}
