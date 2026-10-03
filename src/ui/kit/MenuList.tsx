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
  indicator?: (state: MenuRenderState) => React.ReactNode;
  initialIndex?: number;
  wrap?: boolean;
  rowGap?: number;
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
  dir: 1 | -1,
  wrap: boolean,
): number {
  const n = items.length;
  if (n === 0) return from;
  let i = from;
  for (let c = 0; c < n; c++) {
    i += dir;
    if (i < 0) {
      if (!wrap) return from;
      i = n - 1;
    } else if (i >= n) {
      if (!wrap) return from;
      i = 0;
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
  indicator?: (state: MenuRenderState) => React.ReactNode;
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

  const marker = indicator ? (
    indicator(state)
  ) : (
    <Box marginRight={1}>
      <Text
        color={
          state.focused && state.selected
            ? "greenBright"
            : state.selected
              ? "green"
              : undefined
        }
      >
        {state.selected ? "❯" : " "}
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
}: MenuListProps) {
  const { boundKeyboard, focusSet } = useKeyboard();
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

  const move = useCallback((dir: 1 | -1) => {
    setIndex((prev) => seek(itemsRef.current, prev, dir, wrapRef.current));
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
    const unbinds = [
      boundKeyboard(["up"], () => move(-1), { focusId: focusOpt }),
      boundKeyboard(["down"], () => move(1), { focusId: focusOpt }),
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
    return () => unbinds.forEach((u) => u());
  }, [boundKeyboard, focusOpt, move, activate]);

  return (
    <Box flexDirection="column">
      {items.map((item, i) => {
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
            rowGap={rowGap}
          />
        );
      })}
    </Box>
  );
}
