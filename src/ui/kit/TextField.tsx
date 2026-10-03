import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text } from "ink";
import {
  isNormalCharacter,
  useFocusState,
  useKeyboard,
  useMouseRegion,
} from "ink-cartridge";

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
}: TextFieldProps) {
  const { boundKeyboard, focusSet } = useKeyboard();
  const focused = useFocusState(focusId, group);
  const [cursorOn, setCursorOn] = useState(true);

  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const focusOpt = useMemo(
    () => (group ? { group, focusId } : focusId),
    [group, focusId],
  );

  const ref = useMouseRegion(
    { onClick: () => focusSet(focusId, group) },
    {},
  );

  // Bind keys first — this registers the focus target that focusSet below needs.
  useEffect(() => {
    const unbinds = [
      boundKeyboard(
        ["*"],
        (input, key) => {
          if (!isNormalCharacter(input, key)) return;
          onChangeRef.current(valueRef.current + input);
        },
        { ref, focusId: focusOpt },
      ),
      boundKeyboard(
        ["backspace", "delete"],
        () => onChangeRef.current(valueRef.current.slice(0, -1)),
        { ref, focusId: focusOpt },
      ),
      boundKeyboard(
        ["ctrl+u"],
        () => onChangeRef.current(""),
        { ref, focusId: focusOpt },
      ),
      boundKeyboard(
        ["return"],
        () => onSubmitRef.current?.(valueRef.current),
        { ref, focusId: focusOpt },
      ),
    ];
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, focusOpt, ref]);

  // Grab focus when the field appears (after the binding has registered it).
  useEffect(() => {
    if (!autoFocus) return;
    try {
      focusSet(focusId, group);
    } catch {
      // target not registered yet — auto-activation will cover the single-field case
    }
  }, [autoFocus, focusSet, focusId, group]);

  // Blinking caret only while focused.
  useEffect(() => {
    if (!focused) {
      setCursorOn(true);
      return;
    }
    const t = setInterval(() => setCursorOn((c) => !c), 500);
    return () => clearInterval(t);
  }, [focused]);

  const shown = mask ? mask.repeat(value.length) : value;

  return (
    <Box ref={ref}>
      {shown.length > 0 ? (
        <Text color={focused ? color : "gray"}>{shown}</Text>
      ) : placeholder ? (
        <Text dimColor>{placeholder}</Text>
      ) : null}
      {focused ? (
        <Text color="gray">{cursorOn ? "█" : " "}</Text>
      ) : null}
    </Box>
  );
}
