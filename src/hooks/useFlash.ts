import { useCallback, useEffect, useRef, useState } from "react";

export interface FlashState<T> {
  value: T | null;
  /** Show `v`, auto-clearing after the configured duration. */
  flash: (v: T) => void;
  /** Set a value that stays until explicitly cleared (cancels any pending auto-clear). */
  set: (v: T | null) => void;
  /** Clear the value and cancel any pending timer. */
  reset: () => void;
}

/**
 * A single transient message with a guaranteed timer lifetime. The timeout id
 * lives in a ref so it is cleared both on unmount and before re-arming — a
 * second `flash` cancels the first (otherwise the older timeout would blank the
 * newer message early), and no timeout fires after the host unmounts.
 */
export function useFlash<T = string>(durationMs = 3000): FlashState<T> {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const set = useCallback(
    (v: T | null) => {
      clear();
      setValue(v);
    },
    [clear],
  );

  const flash = useCallback(
    (v: T) => {
      clear();
      setValue(v);
      timer.current = setTimeout(() => {
        timer.current = null;
        setValue(null);
      }, durationMs);
    },
    [clear, durationMs],
  );

  const reset = useCallback(() => {
    clear();
    setValue(null);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { value, flash, set, reset };
}

/**
 * A `setTimeout` wrapper that tracks every pending id and clears them all on
 * unmount. Use when several independent timers may be in flight (e.g. one per
 * toast) so a component teardown cannot leak them.
 */
export function useTrackedTimeout(): (fn: () => void, ms: number) => void {
  const ids = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const pending = ids.current;
    return () => {
      for (const id of pending) clearTimeout(id);
      pending.clear();
    };
  }, []);

  return useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      ids.current.delete(id);
      fn();
    }, ms);
    ids.current.add(id);
  }, []);
}
