import { describe, it, expect } from "vitest";
import {
  createSaveScheduler,
  DEFAULT_SAVE_DELAY_MS,
} from "../../core/archive/saveScheduler.js";

/**
 * A manual clock, so the coalescing rules are asserted against an exact
 * timeline instead of wall-clock timing.
 */
class FakeClock {
  public now = 0;
  public cleared: unknown[] = [];
  private nextId = 1;
  private timers = new Map<number, { fn: () => void; at: number }>();

  public setTimer = (fn: () => void, ms: number): unknown => {
    const id = this.nextId++;
    this.timers.set(id, { fn, at: this.now + ms });
    return id;
  };

  public clearTimer = (handle: unknown): void => {
    this.cleared.push(handle);
    this.timers.delete(handle as number);
  };

  /** Move the clock forward, running every timer that comes due. */
  public advance(ms: number): void {
    this.now += ms;
    const due = [...this.timers.entries()]
      .filter(([, t]) => t.at <= this.now)
      .sort((a, b) => a[1].at - b[1].at);
    for (const [id, t] of due) {
      if (!this.timers.has(id)) continue;
      this.timers.delete(id);
      t.fn();
    }
  }

  public get liveTimers(): number {
    return this.timers.size;
  }
}

function harness(delayMs?: number) {
  const clock = new FakeClock();
  let writes = 0;
  const scheduler = createSaveScheduler({
    write: () => {
      writes++;
    },
    delayMs,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  return {
    clock,
    scheduler,
    get writes() {
      return writes;
    },
  };
}

describe("createSaveScheduler", () => {
  it("does not write until the window elapses", () => {
    const h = harness(100);
    h.scheduler.request();
    expect(h.writes).toBe(0);
    h.clock.advance(99);
    expect(h.writes).toBe(0);
    h.clock.advance(1);
    expect(h.writes).toBe(1);
  });

  it("collapses a burst of requests into a single write", () => {
    const h = harness(100);
    for (let i = 0; i < 10; i++) {
      h.scheduler.request();
      h.clock.advance(5);
    }
    expect(h.writes).toBe(0);
    h.clock.advance(100);
    expect(h.writes).toBe(1);
  });

  it("writes again for a request that arrives after the window", () => {
    const h = harness(100);
    h.scheduler.request();
    h.clock.advance(100);
    h.scheduler.request();
    h.clock.advance(100);
    expect(h.writes).toBe(2);
  });

  it("flushes immediately instead of waiting for the window", () => {
    const h = harness(100);
    h.scheduler.request();
    h.scheduler.flush();
    expect(h.writes).toBe(1);
    // The timer it replaced must not fire a second write later.
    h.clock.advance(1000);
    expect(h.writes).toBe(1);
  });

  it("flushing with nothing pending is a no-op", () => {
    const h = harness(100);
    h.scheduler.flush();
    expect(h.writes).toBe(0);
    expect(h.clock.liveTimers).toBe(0);
  });

  it("cancels a pending write without running it", () => {
    const h = harness(100);
    h.scheduler.request();
    h.scheduler.cancel();
    h.clock.advance(1000);
    expect(h.writes).toBe(0);
  });

  it("accepts a new request after a cancel", () => {
    const h = harness(100);
    h.scheduler.request();
    h.scheduler.cancel();
    h.scheduler.request();
    h.clock.advance(100);
    expect(h.writes).toBe(1);
  });

  it("reports whether a write is pending", () => {
    const h = harness(100);
    expect(h.scheduler.pending).toBe(false);
    h.scheduler.request();
    expect(h.scheduler.pending).toBe(true);
    h.clock.advance(100);
    expect(h.scheduler.pending).toBe(false);
  });

  it("leaves no live timer behind after cancelling", () => {
    const h = harness(100);
    h.scheduler.request();
    expect(h.clock.liveTimers).toBe(1);
    h.scheduler.cancel();
    expect(h.clock.liveTimers).toBe(0);
    expect(h.clock.cleared).toHaveLength(1);
  });

  it("re-arms when the write itself requests another save", () => {
    const clock = new FakeClock();
    let writes = 0;
    const scheduler = createSaveScheduler({
      write: () => {
        writes++;
        // A save that resolves a pending choice is a real case: the write
        // completes the state, and the follow-up must still be schedulable.
        if (writes === 1) scheduler.request();
      },
      delayMs: 50,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });

    scheduler.request();
    clock.advance(50);
    expect(writes).toBe(1);
    expect(scheduler.pending).toBe(true);

    clock.advance(50);
    expect(writes).toBe(2);
    expect(scheduler.pending).toBe(false);
  });

  it("defaults the window to DEFAULT_SAVE_DELAY_MS", () => {
    const h = harness(); // no delay supplied
    h.scheduler.request();
    h.clock.advance(DEFAULT_SAVE_DELAY_MS - 1);
    expect(h.writes).toBe(0);
    h.clock.advance(1);
    expect(h.writes).toBe(1);
  });
});
