import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text } from "ink";
import { useMouseRegion } from "ink-cartridge";
import { useTerminalSize } from "../TerminalSizeContext.js";

export interface ModalFrameProps {
  width: number;
  height?: number;
  title?: React.ReactNode;
  borderColor?: string;
  backgroundColor?: string;
  children: React.ReactNode;
  /**
   * When true the frame can be dragged around by the mouse — a showcase of
   * ink-cartridge drag regions. Child controls keep hit priority over the
   * frame body, so clicks on buttons inside still work.
   */
  draggable?: boolean;
  paddingX?: number;
  paddingY?: number;
}

/**
 * An absolutely-positioned, centred, bordered panel for rendering inside a
 * modal layer. Optionally draggable via mouse.
 */
export function ModalFrame({
  width,
  height,
  title,
  borderColor = "yellow",
  backgroundColor = "black",
  children,
  draggable = false,
  paddingX = 2,
  paddingY = 1,
}: ModalFrameProps) {
  const { columns, rows } = useTerminalSize();

  const centered = useMemo(
    () => ({
      top: Math.max(0, Math.floor((rows - (height ?? 12)) / 2)),
      left: Math.max(0, Math.floor((columns - width) / 2)),
    }),
    [rows, columns, height, width],
  );

  const [pos, setPos] = useState(centered);
  const draggedRef = useRef(false);
  useEffect(() => {
    if (!draggedRef.current) setPos(centered);
  }, [centered]);

  const dragRef = useRef<{ x: number; y: number; top: number; left: number } | null>(
    null,
  );

  const ref = useMouseRegion(
    {
      onDragStart: (event) => {
        if (!draggable) return;
        draggedRef.current = true;
        dragRef.current = {
          x: event.x,
          y: event.y,
          top: pos.top,
          left: pos.left,
        };
      },
      onDragMove: (event) => {
        if (!draggable || !dragRef.current) return;
        const dx = event.x - dragRef.current.x;
        const dy = event.y - dragRef.current.y;
        setPos({
          top: Math.max(0, dragRef.current.top + dy),
          left: Math.max(0, dragRef.current.left + dx),
        });
      },
      onDragEnd: () => {
        dragRef.current = null;
      },
    },
    { priority: 0 },
  );

  return (
    <Box
      ref={ref}
      position="absolute"
      top={pos.top}
      left={pos.left}
      width={width}
      height={height}
      borderStyle="round"
      borderColor={borderColor}
      backgroundColor={backgroundColor}
      flexDirection="column"
      paddingX={paddingX}
      paddingY={paddingY}
    >
      {title ? (
        <Box marginBottom={1}>
          <Text bold color={borderColor}>
            {title}
          </Text>
          {draggable ? <Text dimColor>{"  ⠿ drag"}</Text> : null}
        </Box>
      ) : null}
      {children}
    </Box>
  );
}
