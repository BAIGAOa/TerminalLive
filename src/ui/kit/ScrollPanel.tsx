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
}

/**
 * Fixed-height scrollable viewport. The mouse wheel scrolls it (via a mouse
 * region); PageUp/PageDown/Up/Down scroll it while its focus target is active.
 */
export function ScrollPanel({
  lines,
  height,
  focusId,
  group,
  stickToEnd = false,
  showBar = true,
  barColor = "gray",
}: ScrollPanelProps) {
  const { boundKeyboard } = useKeyboard();
  const [offset, setOffset] = useState(0);

  const maxOffset = Math.max(0, lines.length - height);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;
  const maxRef = useRef(maxOffset);
  maxRef.current = maxOffset;

  const clamp = (v: number) => Math.max(0, Math.min(maxRef.current, v));

  // Follow the tail when asked (e.g. a live journal).
  useEffect(() => {
    if (stickToEnd) setOffset(maxOffset);
  }, [stickToEnd, maxOffset, lines.length]);

  const ref = useMouseRegion(
    {
      onWheel: (event) => {
        const dir = event.button === "wheel-up" ? -1 : 1;
        setOffset((o) => clamp(o + dir));
      },
    },
    { priority: 1 },
  );

  useEffect(() => {
    if (!focusId) return;
    const focusOpt = group ? { group, focusId } : focusId;
    const page = Math.max(1, height - 1);
    const unbinds = [
      boundKeyboard(["up"], () => setOffset((o) => clamp(o - 1)), { focusId: focusOpt }),
      boundKeyboard(["down"], () => setOffset((o) => clamp(o + 1)), { focusId: focusOpt }),
      boundKeyboard(["pageup"], () => setOffset((o) => clamp(o - page)), { focusId: focusOpt }),
      boundKeyboard(["pagedown"], () => setOffset((o) => clamp(o + page)), { focusId: focusOpt }),
      boundKeyboard(["home"], () => setOffset(0), { focusId: focusOpt }),
      boundKeyboard(["end"], () => setOffset(maxRef.current), { focusId: focusOpt }),
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
