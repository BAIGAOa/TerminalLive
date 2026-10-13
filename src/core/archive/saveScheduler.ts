/**
 * Coalesce a burst of save requests into a single write.
 *
 * Auto-save is driven by game events, and several of them land in the same tick
 * (`choice:resolved` and then `turn:ended`, say). Capturing the whole game and
 * writing it synchronously once per event is pure waste when only the final
 * state is ever read back — so requests that arrive inside the window collapse
 * into one write.
 *
 * Timers are injected rather than reached for globally, so the coalescing rules
 * are testable without a real clock.
 */

export interface SaveScheduler {
  /** Ask for a write. Coalesces with any request already inside the window. */
  request(): void;
  /** Write now if a request is pending, then clear it. */
  flush(): void;
  /** Drop a pending request without writing — a life that just ended. */
  cancel(): void;
  /** Whether a write is waiting for the window to elapse. */
  readonly pending: boolean;
}

export interface SaveSchedulerOptions {
  /** What to run when the window elapses. */
  write: () => void;
  /** Milliseconds a request waits before it is written. */
  delayMs?: number;
  /** Injectable for tests; defaults to the global `setTimeout`. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  /** Injectable for tests; defaults to the global `clearTimeout`. */
  clearTimer?: (handle: unknown) => void;
}

/**
 * Long enough to swallow the events that share a tick, short enough that a
 * crash only ever costs a fraction of a second of play.
 */
export const DEFAULT_SAVE_DELAY_MS = 150;

export function createSaveScheduler(options: SaveSchedulerOptions): SaveScheduler {
  const write = options.write;
  const delayMs = options.delayMs ?? DEFAULT_SAVE_DELAY_MS;
  const setTimer =
    options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  // Tracked separately from the handle: an injected timer is free to return
  // `undefined` (or 0), and "is a write armed" must not depend on that.
  let armed = false;
  let handle: unknown = null;

  const disarm = (): void => {
    if (!armed) return;
    armed = false;
    clearTimer(handle);
    handle = null;
  };

  return {
    request() {
      // Already waiting — the pending write will capture this state too.
      if (armed) return;
      armed = true;
      handle = setTimer(() => {
        armed = false;
        handle = null;
        write();
      }, delayMs);
    },
    flush() {
      if (!armed) return;
      disarm();
      write();
    },
    cancel: disarm,
    get pending() {
      return armed;
    },
  };
}
