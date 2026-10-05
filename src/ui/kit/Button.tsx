import React, { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { useFocusState, useKeyboard, useMouseRegion } from "ink-cartridge";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** When set, the button is a focus target and Enter triggers it. */
  focusId?: string;
  group?: string;
  color?: string;
  hoverColor?: string;
  border?: boolean;
  paddingX?: number;
}

/**
 * Clickable (and optionally focusable) button. Hover highlights it; a click
 * presses it. With a `focusId`, Enter also presses it while focused, so mouse
 * and keyboard share the same affordance.
 */
export function Button({
  label,
  onPress,
  focusId,
  group,
  color = "white",
  hoverColor = "green",
  border = true,
  paddingX = 1,
}: ButtonProps) {
  const { boundKeyboard, focusSet } = useKeyboard();
  const [hovered, setHovered] = useState(false);
  const activeFocus = useFocusState(focusId ?? "", group);
  const focused = focusId ? activeFocus : false;

  // Keep the latest handler without rebinding the Enter key on every render.
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const ref = useMouseRegion(
    {
      onEnter: () => setHovered(true),
      onLeave: () => setHovered(false),
      onClick: () => {
        if (focusId) {
          try {
            focusSet(focusId, group);
          } catch {
            // target not registered yet
          }
        }
        onPressRef.current();
      },
    },
    { priority: 1 },
  );

  useEffect(() => {
    if (!focusId) return;
    return boundKeyboard(["return"], () => onPressRef.current(), {
      ref,
      focusId: group ? { group, focusId } : focusId,
    });
  }, [boundKeyboard, focusId, group, ref]);

  const active = hovered || focused;
  const textColor = active ? hoverColor : color;

  if (!border) {
    return (
      <Box ref={ref} paddingX={paddingX}>
        <Text color={textColor} bold={active}>
          {label}
        </Text>
      </Box>
    );
  }

  return (
    <Box ref={ref}>
      <Box
        borderStyle="bold"
        borderColor={active ? hoverColor : "gray"}
        paddingX={paddingX}
      >
        <Text color={textColor} bold={active}>
          {label}
        </Text>
      </Box>
    </Box>
  );
}
