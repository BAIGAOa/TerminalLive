import React, { useLayoutEffect, useRef, useState } from "react";
import { Box, measureElement, useCursor } from "ink";
import type { DOMElement } from "ink";

/** How a text field draws its caret. */
export type CaretStyle =
  /** A blinking `█` glyph — works anywhere, including non-TTY output. */
  | "block"
  /**
   * The real terminal cursor, parked at the caret with ink's `useCursor`. Lets
   * the terminal's own IME follow the typing position.
   */
  | "terminal";

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
 * would fight whatever else is drawing a caret on screen).
 *
 * Shared by {@link TextField} and {@link TextArea} — a multi-line field parks
 * the same cursor, just on whichever row the caret is on.
 */
export function TerminalCaret({ active }: { active: boolean }) {
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
