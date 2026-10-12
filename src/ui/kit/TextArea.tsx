import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text } from "ink";
import {
  isNormalCharacter,
  useFocusState,
  useKeyboard,
  useMouseRegion,
} from "ink-cartridge";
import {
  backspace,
  caretLeft,
  caretRight,
  clampCursor,
  clear,
  deleteForward,
  insertText,
  type TextEditState,
} from "../textEdit.js";
import { layoutTextArea, moveVertical, rowEnd, rowStart } from "../textArea.js";
import { windowStart } from "./listNav.js";
import { TerminalCaret, type CaretStyle } from "./TerminalCaret.js";

export interface TextAreaProps {
  value: string;
  onChange: (next: string) => void;
  /** Called on Ctrl+S — Enter is a newline here, not a submit. */
  onSubmit?: (value: string) => void;
  focusId: string;
  group?: string;
  placeholder?: string;
  color?: string;
  /** Terminal columns the text may occupy (the box's inner width). */
  width: number;
  /** Visible rows. The value scrolls once it is taller than this. */
  height: number;
  autoFocus?: boolean;
  /**
   * Caret style; defaults to the real terminal cursor. A real cursor is right
   * for a long answer — it is where the terminal's own IME looks — and the
   * block glyph stays available for non-TTY output (tests, piped runs).
   */
  caret?: CaretStyle;
}

/**
 * Multi-line text field — the sibling of {@link TextField} for answers that do
 * not fit on one line.
 *
 * Text wraps at the box's width, ↑/↓ move between *drawn* rows while holding
 * the column, and Enter inserts a newline, so submitting is Ctrl+S. Everything
 * about where the caret lands lives in the pure `textArea` module.
 */
export function TextArea({
  value,
  onChange,
  onSubmit,
  focusId,
  group,
  placeholder,
  color = "white",
  width,
  height,
  autoFocus = true,
  caret = "terminal",
}: TextAreaProps) {
  const { boundKeyboard, focusSet, focusUnregister } = useKeyboard();
  const focused = useFocusState(focusId, group);
  const [cursorOn, setCursorOn] = useState(true);
  const terminalCaret = caret === "terminal";

  const inner = Math.max(1, width);
  const rows = Math.max(1, height);

  // The caret stays the field's own business; callers only see the text.
  const [cursor, setCursor] = useState(value.length);
  const state: TextEditState = { value, cursor: clampCursor(value, cursor) };

  const stateRef = useRef(state);
  stateRef.current = state;
  const widthRef = useRef(inner);
  widthRef.current = inner;
  /** The last value this field emitted, to tell its own edits from external ones. */
  const emittedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const edit = (next: TextEditState) => {
    emittedRef.current = next.value;
    setCursor(next.cursor);
    onChangeRef.current(next.value);
  };
  const editRef = useRef(edit);
  editRef.current = edit;

  // A change the field did not make puts the caret back at the end.
  useEffect(() => {
    if (value !== emittedRef.current) setCursor(value.length);
    emittedRef.current = value;
  }, [value]);

  const focusOpt = useMemo(
    () => (group ? { group, focusId } : focusId),
    [group, focusId],
  );

  const ref = useMouseRegion({ onClick: () => focusSet(focusId, group) }, {});

  useEffect(() => {
    const apply = (fn: (s: TextEditState, w: number) => TextEditState) =>
      editRef.current(fn(stateRef.current, widthRef.current));

    const unbinds = [
      boundKeyboard(
        ["*"],
        (input, key) => {
          if (!isNormalCharacter(input, key)) return;
          apply((s) => insertText(s, input));
        },
        { ref, focusId: focusOpt },
      ),
      boundKeyboard(["backspace"], () => apply((s) => backspace(s)), {
        ref,
        focusId: focusOpt,
      }),
      boundKeyboard(["delete"], () => apply((s) => deleteForward(s)), {
        ref,
        focusId: focusOpt,
      }),
      boundKeyboard(["left"], () => apply((s) => caretLeft(s)), {
        ref,
        focusId: focusOpt,
      }),
      boundKeyboard(["right"], () => apply((s) => caretRight(s)), {
        ref,
        focusId: focusOpt,
      }),
      boundKeyboard(
        ["up"],
        () =>
          apply((s, w) => ({
            value: s.value,
            cursor: moveVertical(s.value, s.cursor, w, -1),
          })),
        { ref, focusId: focusOpt },
      ),
      boundKeyboard(
        ["down"],
        () =>
          apply((s, w) => ({
            value: s.value,
            cursor: moveVertical(s.value, s.cursor, w, 1),
          })),
        { ref, focusId: focusOpt },
      ),
      boundKeyboard(
        ["home"],
        () =>
          apply((s, w) => ({
            value: s.value,
            cursor: rowStart(s.value, s.cursor, w),
          })),
        { ref, focusId: focusOpt },
      ),
      boundKeyboard(
        ["end"],
        () =>
          apply((s, w) => ({
            value: s.value,
            cursor: rowEnd(s.value, s.cursor, w),
          })),
        { ref, focusId: focusOpt },
      ),
      // Enter is a newline; Ctrl+S is the way out.
      boundKeyboard(["return"], () => apply((s) => insertText(s, "\n")), {
        ref,
        focusId: focusOpt,
      }),
      boundKeyboard(["ctrl+u"], () => apply((s) => clear(s)), {
        ref,
        focusId: focusOpt,
      }),
      boundKeyboard(["ctrl+s"], () => onSubmitRef.current?.(stateRef.current.value), {
        ref,
        focusId: focusOpt,
      }),
    ];
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, focusOpt, ref]);

  // Unbinding keys only detaches handlers — the focus target itself outlives
  // them and keeps eating Tab, so it has to be dropped explicitly.
  useEffect(() => {
    return () => {
      try {
        focusUnregister(focusId, group);
      } catch {
        /* target not registered on this layer */
      }
    };
  }, [focusUnregister, focusId, group]);

  useEffect(() => {
    if (!autoFocus) return;
    try {
      focusSet(focusId, group);
    } catch {
      /* target not registered yet */
    }
  }, [autoFocus, focusSet, focusId, group]);

  // Blinking is only for the block glyph — never in terminal-caret mode, where
  // the real cursor does its own blinking and a re-render would just be churn.
  useEffect(() => {
    if (terminalCaret || !focused) {
      setCursorOn(true);
      return;
    }
    const t = setInterval(() => setCursorOn((c) => !c), 500);
    return () => clearInterval(t);
  }, [focused, terminalCaret]);

  const { lines, cursorRow } = layoutTextArea(state.value, state.cursor, inner);

  // Keep the caret's row on screen, scrolling minimally — the same window rule
  // the lists use, so a long answer behaves like a long list.
  const startRef = useRef(0);
  const start =
    lines.length > rows
      ? windowStart(cursorRow, lines.length, rows, startRef.current)
      : 0;
  startRef.current = start;

  const textColor = focused ? color : "gray";
  const at = state.cursor;

  return (
    <Box ref={ref} flexDirection="column" width={inner} height={rows}>
      {Array.from({ length: rows }).map((_, i) => {
        const line = lines[start + i];
        if (!line) {
          return (
            <Box key={i} height={1}>
              <Text> </Text>
            </Box>
          );
        }
        const isCursorRow = focused && start + i === cursorRow;
        if (!isCursorRow) {
          return (
            <Box key={i} height={1} overflowY="hidden">
              <Text color={textColor}>{line.text || " "}</Text>
            </Box>
          );
        }
        const before = state.value.slice(line.start, at);
        const after = state.value.slice(at, line.end);
        return (
          <Box key={i} height={1} overflowY="hidden">
            {before.length > 0 ? <Text color={textColor}>{before}</Text> : null}
            {terminalCaret ? (
              <TerminalCaret active={focused} />
            ) : (
              <Text color="gray">{cursorOn ? "█" : " "}</Text>
            )}
            {after.length > 0 ? <Text color={textColor}>{after}</Text> : null}
          </Box>
        );
      })}
      {state.value.length === 0 && placeholder ? (
        <Box position="absolute" width={inner}>
          <Text dimColor>{placeholder}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
