import React, { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { useKeyboard, useMouseRegion } from "ink-cartridge";

export interface ScrollPanelProps {
  /** One entry per rendered line. */
  lines: React.ReactNode[];
  height: number;
  focusId?: string;
  group?: string;
  /** Keep the newest lines visible as content grows. */
  stickToEnd?: boolean;
  /** Show a right-edge scrollbar. */
  showBar?: boolean;
  barColor?: string;
  /** Controlled offset. When set, the panel stops managing its own state. */
  offset?: number;
  /** Called with the clamped offset on any scroll (wheel or keys). */
  onOffsetChange?: (next: number) => void;
}

/**
 * Fixed-height scrollable viewport. The mouse wheel scrolls it (via a mouse
 * region); with a `focusId`, PageUp/PageDown/Up/Down scroll it while focused.
 * A parent may instead control the offset and bind its own scroll keys.
 */
export function ScrollPanel({
  lines,
  height,
  focusId,
  group,
  stickToEnd = false,
  showBar = true,
  barColor = "gray",
  offset: controlledOffset,
  onOffsetChange,
}: ScrollPanelProps) {
  const { boundKeyboard } = useKeyboard();
  const [internal, setInternal] = useState(0);

  const maxOffset = Math.max(0, lines.length - height);
  const maxRef = useRef(maxOffset);
  maxRef.current = maxOffset;

  const controlled = controlledOffset !== undefined;
  const offset = Math.min(controlled ? controlledOffset : internal, maxOffset);

  const clamp = (v: number) => Math.max(0, Math.min(maxRef.current, v));
  const commit = (next: number) => {
    const v = clamp(next);
    if (controlled) onOffsetChange?.(v);
    else setInternal(v);
  };

  // Refs so the key bindings below stay stable across scroll ticks instead of
  // rebinding all six handlers on every offset change.
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const commitRef = useRef(commit);
  commitRef.current = commit;

  // Follow the tail when asked (uncontrolled live journals only).
  useEffect(() => {
    if (!stickToEnd || controlled) return;
    setInternal(maxOffset);
  }, [stickToEnd, controlled, maxOffset, lines.length]);

  const ref = useMouseRegion(
    {
      onWheel: (event) => {
        const dir = event.button === "wheel-up" ? -1 : 1;
        commit(offset + dir);
      },
    },
    { priority: 1 },
  );

  useEffect(() => {
    if (!focusId) return;
    const focusOpt = group ? { group, focusId } : focusId;
    const page = Math.max(1, height - 1);
    const unbinds = [
      boundKeyboard(["up"], () => commitRef.current(offsetRef.current - 1), { focusId: focusOpt }),
      boundKeyboard(["down"], () => commitRef.current(offsetRef.current + 1), { focusId: focusOpt }),
      boundKeyboard(["pageup"], () => commitRef.current(offsetRef.current - page), { focusId: focusOpt }),
      boundKeyboard(["pagedown"], () => commitRef.current(offsetRef.current + page), { focusId: focusOpt }),
      boundKeyboard(["home"], () => commitRef.current(0), { focusId: focusOpt }),
      boundKeyboard(["end"], () => commitRef.current(maxRef.current), { focusId: focusOpt }),
    ];
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, focusId, group, height]);

  const visible = lines.slice(offset, offset + height);
  const thumbTop = maxOffset === 0 ? 0 : Math.round((offset / maxOffset) * (height - 1));

  return (
    <Box ref={ref} flexDirection="row" height={height}>
      <Box flexDirection="column" flexGrow={1}>
        {Array.from({ length: height }).map((_, i) => (
          <Box key={i} height={1} flexShrink={0} overflowY="hidden">
            {visible[i] ?? null}
          </Box>
        ))}
      </Box>
      {showBar && height > 0 ? (
        <Box flexDirection="column" marginLeft={1}>
          {Array.from({ length: height }).map((_, i) => (
            <Text key={i} color={i === thumbTop ? barColor : undefined} dimColor={i !== thumbTop}>
              {i === thumbTop ? "█" : "│"}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
