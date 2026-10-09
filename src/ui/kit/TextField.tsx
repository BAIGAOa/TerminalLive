import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Box, Text, measureElement, useCursor } from "ink";
import type { DOMElement } from "ink";
import {
  isNormalCharacter,
  useFocusState,
  useKeyboard,
  useMouseRegion,
} from "ink-cartridge";
import {
  TextEditState,
  backspace,
  caretEnd,
  caretLeft,
  caretRight,
  caretStart,
  clampCursor,
  clear,
  deleteForward,
  insertText,
  maskedCursor,
  splitAtCaret,
} from "../textEdit.js";

/** How the caret is drawn. */
export type CaretStyle =
  /** A blinking `█` glyph — works anywhere, including non-TTY output. */
  | "block"
  /**
   * The real terminal cursor, parked at the caret with ink's `useCursor`. Lets
   * the terminal's own IME follow the typing position.
   */
  | "terminal";

export interface TextFieldProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: (value: string) => void;
  focusId: string;
  group?: string;
  placeholder?: string;
  /** When set, input is masked with this character (e.g. "•"). */
  mask?: string;
  color?: string;
  autoFocus?: boolean;
  /** Caret style; defaults to the block glyph. */
  caret?: CaretStyle;
}

interface CaretPosition {
  x: number;
  y: number;
}

/**
 * A zero-width anchor that parks the real terminal cursor where the caret is.
 *
 * Split out so `useCursor` is only mounted by fields that actually ask for a
 * terminal caret: the hook drives one global cursor, so a field that leaves it
 * alone must not touch it (an always-mounted `setCursorPosition(undefined)`
 * would fight the console's caret whenever both are on screen).
 */
function TerminalCaret({ active }: { active: boolean }) {
  const ref = useRef<DOMElement | null>(null);
  const { setCursorPosition } = useCursor();
  const [pos, setPos] = useState<CaretPosition | undefined>(undefined);

  // Deliberately no dependency array: the field also moves when an ancestor
  // re-lays out (a dragged modal, a resize), which is invisible here.
  useLayoutEffect(() => {
    const anchor = ref.current;
    if (!active || !anchor) {
      setPos((prev) => (prev === undefined ? prev : undefined));
      return;
    }
    const { x, y } = measureElement(anchor);
    setPos((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
  });

  // Assigned during render so ink's insertion effect — which runs before the
  // layout effects, and only during a commit — picks it up on this very render.
  setCursorPosition(active ? pos : undefined);

  return <Box ref={ref} />;
}

/**
 * Controlled single-line text field — the ink-cartridge replacement for
 * ink-kit's `TextInput`.
 *
 * Character input is a wildcard `*` binding on the field's focus target, so it
 * only receives keys while focused (Tab away and it goes dormant). Clicking the
 * field focuses it, linking mouse and keyboard on the same target.
 */
export function TextField({
  value,
  onChange,
  onSubmit,
  focusId,
  group,
  placeholder,
  mask,
  color = "white",
  autoFocus = true,
  caret = "block",
}: TextFieldProps) {
  const { boundKeyboard, focusSet, focusUnregister } = useKeyboard();
  const focused = useFocusState(focusId, group);
  const [cursorOn, setCursorOn] = useState(true);
  const terminalCaret = caret === "terminal";

  // The caret is the field's own business: the caller only ever sees the text.
  // Clamped at render so a value that shrank under us can never point past its
  // end for the frame before the syncing effect below runs.
  const [cursor, setCursor] = useState(value.length);
  const state: TextEditState = { value, cursor: clampCursor(value, cursor) };

  const stateRef = useRef(state);
  stateRef.current = state;
  /** Last value this field emitted, to tell its own edits from external ones. */
  const emittedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  /** Apply an edit: hand the caller the new text and keep the caret with it. */
  const edit = (next: TextEditState) => {
    emittedRef.current = next.value;
    setCursor(next.cursor);
    onChangeRef.current(next.value);
  };
  const editRef = useRef(edit);
  editRef.current = edit;

  // A change the field did not make (history recall, an applied completion, the
  // line being cleared on submit) puts the caret back at the end — the way a
  // shell prompt behaves.
  useEffect(() => {
    if (value !== emittedRef.current) setCursor(value.length);
    emittedRef.current = value;
  }, [value]);

  const focusOpt = useMemo(
    () => (group ? { group, focusId } : focusId),
    [group, focusId],
  );

  const ref = useMouseRegion(
    { onClick: () => focusSet(focusId, group) },
    {},
  );

  // Bind keys first — this registers the focus target that focusSet below needs.
  // Each handler reads the live text+caret from `stateRef`, so the bindings
  // never have to be rebuilt as the user types.
  useEffect(() => {
    const apply = (fn: (s: TextEditState) => TextEditState) =>
      editRef.current(fn(stateRef.current));
    const unbinds = [
      boundKeyboard(
        ["*"],
        (input, key) => {
          if (!isNormalCharacter(input, key)) return;
          apply((s) => insertText(s, input));
        },
        { ref, focusId: focusOpt },
      ),
      // Backspace eats backwards, Delete eats forwards — the caret stays put.
      boundKeyboard(["backspace"], () => apply(backspace), { ref, focusId: focusOpt }),
      boundKeyboard(["delete"], () => apply(deleteForward), { ref, focusId: focusOpt }),
      boundKeyboard(["left"], () => apply(caretLeft), { ref, focusId: focusOpt }),
      boundKeyboard(["right"], () => apply(caretRight), { ref, focusId: focusOpt }),
      boundKeyboard(["home"], () => apply(caretStart), { ref, focusId: focusOpt }),
      boundKeyboard(["end"], () => apply(caretEnd), { ref, focusId: focusOpt }),
      boundKeyboard(["ctrl+u"], () => apply(clear), { ref, focusId: focusOpt }),
      boundKeyboard(
        ["return"],
        () => onSubmitRef.current?.(stateRef.current.value),
        { ref, focusId: focusOpt },
      ),
    ];
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, focusOpt, ref]);

  // Drop the focus target on unmount. Unbinding its keys only detaches the
  // handlers — the target itself stays in the layer's focus order, and with
  // `autoTab` on the engine keeps eating Tab for a target that no longer
  // exists (the console could never re-enter input mode after Esc).
  useEffect(() => {
    return () => {
      try {
        focusUnregister(focusId, group);
      } catch {
        /* target not registered on this layer */
      }
    };
  }, [focusUnregister, focusId, group]);

  // Grab focus when the field appears (after the binding has registered it).
  useEffect(() => {
    if (!autoFocus) return;
    try {
      focusSet(focusId, group);
    } catch {
      // target not registered yet — auto-activation will cover the single-field case
    }
  }, [autoFocus, focusSet, focusId, group]);

  // A mask replaces each character, so the masked text can be longer than the
  // value (an emoji mask, or any multi-character one) and the caret has to be
  // mapped rather than reused as an index.
  const maskChar = mask ? ([...mask][0] ?? "") : "";
  const shown = maskChar ? maskChar.repeat([...value].length) : value;
  const { before, after } = splitAtCaret({
    value: shown,
    cursor: maskedCursor(value, state.cursor, maskChar),
  });
  const textColor = focused ? color : "gray";

  // Blinking caret only while focused — and never in terminal-caret mode,
  // where the real cursor is the caret.
  useEffect(() => {
    if (terminalCaret || !focused) {
      setCursorOn(true);
      return;
    }
    const t = setInterval(() => setCursorOn((c) => !c), 500);
    return () => clearInterval(t);
  }, [focused, terminalCaret]);

  return (
    <Box ref={ref}>
      {before.length > 0 ? <Text color={textColor}>{before}</Text> : null}
      {/* Zero-width, so it never shifts the text after it — it only gives the
          terminal caret something to be measured against. */}
      {terminalCaret ? <TerminalCaret active={focused} /> : null}
      {!terminalCaret && focused ? (
        <Text color="gray">{cursorOn ? "█" : " "}</Text>
      ) : null}
      {shown.length === 0 && placeholder ? (
        <Text dimColor>{placeholder}</Text>
      ) : null}
      {after.length > 0 ? <Text color={textColor}>{after}</Text> : null}
    </Box>
  );
}
