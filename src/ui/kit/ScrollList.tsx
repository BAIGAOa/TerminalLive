import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box } from "ink";
import { useFocusState, useKeyboard, useMouseRegion } from "ink-cartridge";
import type { MenuEntry, MenuRenderState } from "./MenuList.js";

export interface ScrollListProps {
  items: MenuEntry[];
  focusId?: string;
  group?: string;
  /** Fixed height (in lines) of every item — required for windowing. */
  itemHeight: number;
  /** Viewport height in lines (defaults to showing every item). */
  height?: number;
  onSelect?: (item: MenuEntry, index: number) => void;
  onChange?: (item: MenuEntry, index: number) => void;
  /** Rendered inside a fixed-height, clipped row — draw up to `itemHeight` lines. */
  renderItem: (item: MenuEntry, state: MenuRenderState) => React.ReactNode;
  wrap?: boolean;
}

function ScrollRow({
  item,
  index,
  state,
  itemHeight,
  onHover,
  onActivate,
  onWheel,
  renderItem,
}: {
  item: MenuEntry;
  index: number;
  state: MenuRenderState;
  itemHeight: number;
  onHover: (index: number) => void;
  onActivate: (index: number) => void;
  onWheel: (delta: number) => void;
  renderItem: (item: MenuEntry, state: MenuRenderState) => React.ReactNode;
}) {
  const ref = useMouseRegion(
    {
      onEnter: () => onHover(index),
      onClick: () => onActivate(index),
      onWheel: (event) => onWheel(event.button === "wheel-up" ? -1 : 1),
    },
    { priority: 1 },
  );
  return (
    <Box
      ref={ref}
      height={itemHeight}
      width="100%"
      flexShrink={0}
      flexDirection="column"
      overflowY="hidden"
    >
      {renderItem(item, state)}
    </Box>
  );
}

/**
 * A scrollable, focusable list whose rows are **multi-line** (fixed
 * `itemHeight`). Unlike {@link ScrollPanel} — which slices single lines — this
 * keeps each item intact and scrolls by whole rows, so bordered cards never
 * collapse onto each other. Keyboard (↑↓/PageUp/PageDown/Enter) and mouse
 * (hover/click/wheel) both work.
 */
export function ScrollList({
  items,
  focusId,
  group,
  itemHeight,
  height,
  onSelect,
  onChange,
  renderItem,
  wrap = true,
}: ScrollListProps) {
  const { boundKeyboard, focusSet } = useKeyboard();
  const focused = useFocusState(focusId ?? "", group);

  const rows = height ? Math.max(1, Math.floor(height / itemHeight)) : items.length;
  const maxOffset = Math.max(0, items.length - rows);

  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);

  const indexRef = useRef(index);
  indexRef.current = index;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Keep the selected row inside the window.
  useEffect(() => {
    setOffset((o) => {
      if (index < o) return index;
      if (index >= o + rows) return index - rows + 1;
      return Math.min(o, maxOffset);
    });
  }, [index, rows, maxOffset]);

  useEffect(() => {
    setIndex((p) => Math.min(Math.max(0, p), Math.max(0, items.length - 1)));
  }, [items]);

  useEffect(() => {
    const it = items[index];
    if (it) onChangeRef.current?.(it, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const step = useCallback((delta: number) => {
    setIndex((prev) => {
      const n = itemsRef.current.length;
      if (n === 0) return 0;
      let next = prev + delta;
      if (next < 0) next = wrap ? n - 1 : 0;
      if (next >= n) next = wrap ? 0 : n - 1;
      return next;
    });
  }, [wrap]);

  const scroll = useCallback((delta: number) => {
    setOffset((o) => Math.max(0, Math.min(maxOffset, o + delta)));
  }, [maxOffset]);

  const activate = useCallback((i: number) => {
    const it = itemsRef.current[i];
    if (it) onSelectRef.current?.(it, i);
  }, []);

  const hover = useCallback(
    (i: number) => {
      if (focusId) {
        try {
          focusSet(focusId, group);
        } catch {
          /* target not registered yet */
        }
      }
      setIndex(i);
    },
    [focusSet, focusId, group],
  );

  useEffect(() => {
    if (!focusId) return;
    const fo = group ? { group, focusId } : focusId;
    const unbinds = [
      boundKeyboard(["up"], () => step(-1), { focusId: fo }),
      boundKeyboard(["down"], () => step(1), { focusId: fo }),
      boundKeyboard(["pageup"], () => step(-rows), { focusId: fo }),
      boundKeyboard(["pagedown"], () => step(rows), { focusId: fo }),
      boundKeyboard(["home"], () => setIndex(0), { focusId: fo }),
      boundKeyboard(["end"], () => setIndex(Math.max(0, itemsRef.current.length - 1)), { focusId: fo }),
      boundKeyboard(["return"], () => activate(indexRef.current), { focusId: fo }),
    ];
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, focusId, group, step, rows, activate]);

  const visible = items.slice(offset, offset + rows);

  return (
    <Box flexDirection="column" height={rows * itemHeight}>
      {visible.map((item, i) => {
        const gi = offset + i;
        return (
          <ScrollRow
            key={item.value}
            item={item}
            index={gi}
            state={{ selected: gi === index, focused, index: gi }}
            itemHeight={itemHeight}
            onHover={hover}
            onActivate={(j) => {
              hover(j);
              activate(j);
            }}
            onWheel={scroll}
            renderItem={renderItem}
          />
        );
      })}
    </Box>
  );
}
