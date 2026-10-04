import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text } from "ink";
import { useFocusState, useKeyboard, useMouseRegion } from "ink-cartridge";

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
}

function firstEnabled(items: MenuEntry[], from = 0): number {
  for (let i = from; i < items.length; i++) if (!items[i]?.disabled) return i;
  for (let i = 0; i < items.length; i++) if (!items[i]?.disabled) return i;
  return 0;
}

function lastEnabled(items: MenuEntry[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (!items[i]?.disabled) return i;
  return 0;
}

function seek(
  items: MenuEntry[],
  from: number,
  step: number,
  wrap: boolean,
): number {
  const n = items.length;
  if (n === 0 || step === 0) return from;
  let i = from;
  for (let c = 0; c < n; c++) {
    i += step;
    if (i < 0 || i >= n) {
      if (!wrap) return from;
      i = ((i % n) + n) % n;
    }
    if (!items[i]?.disabled) return i;
  }
  return from;
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
}: MenuListProps) {
  const { boundKeyboard, focusSet, focusUnregister } = useKeyboard();
  const focused = useFocusState(focusId, group);

  const [index, setIndex] = useState(() => firstEnabled(items, initialIndex ?? 0));

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

  if (columnWidth == null) {
    return (
      <Box flexDirection="column">
        {items.map((item, i) => renderRow(item, i, rowGap))}
      </Box>
    );
  }

  // Centered, uniform-width grid: each cell is a fixed-width box so buttons
  // align regardless of label length, and every row is centered as a whole.
  const rows: MenuEntry[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return (
    <Box flexDirection="column">
      {rows.map((row, r) => (
        <Box key={r} flexDirection="row" justifyContent="center">
          {row.map((item, c) => (
            <Box
              key={item.value}
              width={columnWidth}
              flexDirection="column"
              marginRight={c < row.length - 1 ? colGap : 0}
            >
              {renderRow(item, r * columns + c, rowGap)}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
