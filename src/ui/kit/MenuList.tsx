import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text } from "ink";
import { useFocusState, useKeyboard, useMouseRegion } from "ink-cartridge";
import { firstEnabled, lastEnabled, seek, windowStart } from "./listNav.js";

export interface MenuEntry {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MenuRenderState {
  selected: boolean;
  focused: boolean;
  index: number;
}

export interface MenuListProps {
  items: MenuEntry[];
  focusId: string;
  /** Named focus group (see ink-cartridge focus system). Omitted = default group. */
  group?: string;
  onSelect?: (item: MenuEntry, index: number) => void;
  /** Fired whenever the highlighted row changes (keyboard or mouse). */
  onChange?: (item: MenuEntry, index: number) => void;
  renderItem?: (item: MenuEntry, state: MenuRenderState) => React.ReactNode;
  /** Pass `null` to render no marker at all. */
  indicator?: ((state: MenuRenderState) => React.ReactNode) | null;
  initialIndex?: number;
  wrap?: boolean;
  rowGap?: number;
  /** Grid columns. `1` (default) = a plain vertical list. */
  columns?: number;
  /**
   * Fixed width of each grid cell. Set it to lay items out in a centered,
   * uniform-width grid; leave unset to fill the parent (vertical list).
   */
  columnWidth?: number;
  /** Horizontal gap between grid cells (default 1). */
  colGap?: number;
  /**
   * Terminal rows the list may occupy. When the list is taller it scrolls to
   * keep the highlight in view and shows a scrollbar; shorter lists are
   * untouched, so giving a height never changes a list that already fits.
   */
  height?: number;
  /**
   * Rows each item occupies — 1 for a plain line, 3 for the bordered rows the
   * game's lists use. `height` is in terminal rows, so this is what divides it
   * into a number of items; get it wrong and the list overflows its box.
   */
  rowHeight?: number;
  /** Scrollbar thumb colour. */
  barColor?: string;
}

function MenuRow({
  item,
  index,
  state,
  onHover,
  onActivate,
  renderItem,
  indicator,
  rowGap,
}: {
  item: MenuEntry;
  index: number;
  state: MenuRenderState;
  onHover: (index: number) => void;
  onActivate: (index: number) => void;
  renderItem?: (item: MenuEntry, state: MenuRenderState) => React.ReactNode;
  indicator?: ((state: MenuRenderState) => React.ReactNode) | null;
  rowGap: number;
}) {
  // Hover/click drive the shared focus target so keyboard and mouse converge.
  const ref = useMouseRegion(
    {
      onEnter: () => onHover(index),
      onClick: () => onActivate(index),
    },
    { priority: 1 },
  );

  // The default marker only shows while this list actually owns the keyboard,
  // so an unfocused list does not look "selected".
  const active = state.focused && state.selected;
  const marker =
    indicator === null ? null : indicator ? (
      indicator(state)
    ) : (
      <Box marginRight={1}>
        <Text color={active ? "greenBright" : undefined}>
          {active ? "❯" : " "}
        </Text>
      </Box>
    );

  return (
    <Box ref={ref} marginBottom={rowGap}>
      {marker}
      {renderItem ? (
        renderItem(item, state)
      ) : (
        <Text bold={state.selected} dimColor={item.disabled}>
          {item.label}
        </Text>
      )}
    </Box>
  );
}

/**
 * A focusable vertical list — the ink-cartridge replacement for ink-kit's
 * `SelectInput`.
 *
 * Keyboard (↑/↓/Home/End/Enter) and mouse (hover highlights + focuses, click
 * selects) both target the same focus id, so Tab-navigation and the cursor
 * converge on one selection. Bindings are gated by the focus target, so with
 * several lists on screen only the active one reacts.
 */
export function MenuList({
  items,
  focusId,
  group,
  onSelect,
  onChange,
  renderItem,
  indicator,
  initialIndex,
  wrap = true,
  rowGap = 0,
  columns = 1,
  columnWidth,
  colGap = 1,
  height,
  rowHeight = 1,
  barColor = "green",
}: MenuListProps) {
  const { boundKeyboard, focusSet, focusUnregister } = useKeyboard();
  const focused = useFocusState(focusId, group);

  const [index, setIndex] = useState(() => firstEnabled(items, initialIndex ?? 0));
  /** Where the viewport currently starts, so the window scrolls minimally. */
  const windowRef = useRef(0);

  const indexRef = useRef(index);
  indexRef.current = index;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const wrapRef = useRef(wrap);
  wrapRef.current = wrap;

  const focusOpt = useMemo(
    () => (group ? { group, focusId } : focusId),
    [group, focusId],
  );

  // Remove the focus target on unmount so a hidden list (e.g. a status view you
  // navigated away from) can't linger in the engine's focus order. Safe when the
  // target isn't on the current layer — the engine no-ops.
  useEffect(() => {
    return () => {
      try {
        focusUnregister(focusId, group);
      } catch {
        /* target not registered on this layer */
      }
    };
  }, [focusUnregister, focusId, group]);

  // Keep the highlight on a valid (enabled) row when the item set changes.
  useEffect(() => {
    setIndex((prev) => {
      if (prev < items.length && items[prev] && !items[prev].disabled) return prev;
      return firstEnabled(items, prev);
    });
  }, [items]);

  // Notify the parent of highlight changes (refs keep this stable).
  useEffect(() => {
    const it = items[index];
    if (it) onChangeRef.current?.(it, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const move = useCallback((step: number) => {
    setIndex((prev) => seek(itemsRef.current, prev, step, wrapRef.current));
  }, []);

  const activate = useCallback((i: number) => {
    const it = itemsRef.current[i];
    if (!it || it.disabled) return;
    onSelectRef.current?.(it, i);
  }, []);

  const hover = useCallback(
    (i: number) => {
      if (itemsRef.current[i]?.disabled) return;
      try {
        focusSet(focusId, group);
      } catch {
        // target not registered yet
      }
      setIndex(i);
    },
    [focusSet, focusId, group],
  );

  useEffect(() => {
    const vertical = columnWidth != null && columns > 1 ? columns : 1;
    const unbinds = [
      boundKeyboard(["up"], () => move(-vertical), { focusId: focusOpt }),
      boundKeyboard(["down"], () => move(vertical), { focusId: focusOpt }),
      boundKeyboard(
        ["home"],
        () => setIndex(firstEnabled(itemsRef.current, 0)),
        { focusId: focusOpt },
      ),
      boundKeyboard(
        ["end"],
        () => setIndex(lastEnabled(itemsRef.current)),
        { focusId: focusOpt },
      ),
      boundKeyboard(["return"], () => activate(indexRef.current), {
        focusId: focusOpt,
      }),
    ];
    if (columnWidth != null && columns > 1) {
      unbinds.push(
        boundKeyboard(["left"], () => move(-1), { focusId: focusOpt }),
        boundKeyboard(["right"], () => move(1), { focusId: focusOpt }),
      );
    }
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, focusOpt, move, activate, columns, columnWidth]);

  const renderRow = (item: MenuEntry, i: number, gap: number) => {
    const state: MenuRenderState = {
      selected: i === index,
      focused,
      index: i,
    };
    return (
      <MenuRow
        key={item.value}
        item={item}
        index={i}
        state={state}
        onHover={hover}
        onActivate={(j) => {
          hover(j);
          activate(j);
        }}
        renderItem={renderItem}
        indicator={indicator}
        rowGap={gap}
      />
    );
  };

  // Window the list when a `height` is given and there is more than fits: a
  // long list (many plugins, many shortcuts) scrolls instead of running off the
  // screen. Short lists are untouched, so nothing else changes shape.
  const visibleCount =
    height && height > 0
      ? Math.max(1, Math.floor(height / Math.max(1, rowHeight)))
      : items.length;
  const scrolling = visibleCount < items.length;
  /** Rows the list actually occupies, for sizing the scrollbar beside it. */
  const visibleRows = scrolling ? visibleCount * Math.max(1, rowHeight) : 0;
  const start = scrolling
    ? windowStart(index, items.length, visibleCount, windowRef.current)
    : 0;
  windowRef.current = start;
  const windowed = scrolling ? items.slice(start, start + visibleCount) : items;
  /** Where the scrollbar thumb sits, as a row of the viewport. */
  const thumbRow = scrolling
    ? Math.round((start / (items.length - visibleCount)) * (visibleCount - 1))
    : 0;

  const renderList = (list: MenuEntry[], indexOf: (i: number) => number, gap: number) => (
    <Box flexDirection="column">
      {list.map((item, i) => renderRow(item, indexOf(i), gap))}
    </Box>
  );

  /** The list itself, plus its scrollbar when the window is narrower than it. */
  const withBar = (list: React.ReactNode) =>
    scrolling ? (
      <Box flexDirection="row">
        {list}
        <Box flexDirection="column" marginLeft={1}>
          {Array.from({ length: Math.min(visibleRows, visibleCount * Math.max(1, rowHeight)) }).map((_, i) => (
            <Text key={i} color={i === thumbRow ? barColor : undefined} dimColor={i !== thumbRow}>
              {i === thumbRow ? "█" : "│"}
            </Text>
          ))}
        </Box>
      </Box>
    ) : (
      list
    );

  if (columnWidth == null) {
    // Absolute indices, so selection and hover stay correct inside the window.
    return withBar(renderList(windowed, (i) => start + i, rowGap));
  }

  // Centered, uniform-width grid: each cell is a fixed-width box so buttons
  // align regardless of label length, and every row is centered as a whole.
  const rows: MenuEntry[][] = [];
  // Guard against columns <= 0, which would make this loop never advance.
  const cols = Math.max(1, Math.floor(columns));
  const first = scrolling ? start - (start % cols) : 0;
  const last = scrolling ? Math.min(items.length, first + visibleCount) : items.length;
  for (let i = first; i < last; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return withBar(
    <Box flexDirection="column">
      {rows.map((row, r) => (
        <Box key={r} flexDirection="row" justifyContent="center">
          {row.map((item, c) => {
            // The row's first absolute index: windowing can start mid-row.
            const absolute = first + r * cols + c;
            return (
              <Box
                key={item.value}
                width={columnWidth}
                flexDirection="column"
                marginRight={c < row.length - 1 ? colGap : 0}
              >
                {renderRow(item, absolute, rowGap)}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>,
  );
}
