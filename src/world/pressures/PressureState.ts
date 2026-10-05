import { container } from "../../Container.js";
import PressureRegistry from "./PressureRegistry.js";
import { PressureClass, PressureDefinition } from "./PressureDefinition.js";

export interface PressureTickResult {
  /** Net change applied to each axis this turn. */
  deltas: Record<string, number>;
}

/**
 * The runtime of the hidden-score web. A container singleton, reset for each
 * new life via {@link reset}.
 */
export default class PressureState {
  private registry: PressureRegistry;
  private values = new Map<string, number>();
  private listeners = new Set<() => void>();
  private version = 0;

  constructor() {
    this.registry = container.resolve(PressureRegistry);
    this.reset();
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): number => this.version;

  private notify(): void {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  public reset(): void {
    this.values = new Map();
    for (const ax of this.registry.getAxes()) this.values.set(ax.id, ax.initial);
    this.notify();
  }

  public get(id: string): number {
    const ax = this.registry.getAxis(id);
    if (!ax) return 0;
    const v = this.values.get(id);
    return v === undefined ? ax.initial : v;
  }

  /**
   * Whether `id` is an axis of the *currently active* content set. World-scoped
   * worlds clear the classic axes, so consumers that bias behavior off an axis
   * must distinguish "absent" from "value 0".
   */
  public has(id: string): boolean {
    return this.registry.getAxis(id) !== undefined;
  }

  public set(id: string, value: number): void {
    const ax = this.registry.getAxis(id);
    if (!ax) return;
    this.values.set(id, Math.max(ax.min, Math.min(ax.max, value)));
  }

  public adjust(id: string, delta: number): void {
    this.set(id, this.get(id) + delta);
  }

  /** Axis value as a 0..1 fraction of its range. */
  public normalized(id: string): number {
    const ax = this.registry.getAxis(id);
    if (!ax || ax.max === ax.min) return 0;
    return (this.get(id) - ax.min) / (ax.max - ax.min);
  }

  public axesOf(cls: PressureClass): Array<[PressureDefinition, number]> {
    return this.registry
      .getAxes()
      .filter((a) => a.class === cls)
      .map((a) => [a, this.get(a.id)] as [PressureDefinition, number]);
  }

  /**
   * Advance one year: apply every coupling rule (simultaneously, from the
   * current values), pull each axis toward its baseline, then optionally add
   * `jitter` noise. Returns the net per-axis change.
   */
  public tick(rand: () => number, jitter = 0): PressureTickResult {
    const deltas = new Map<string, number>();
    const add = (id: string, d: number) => deltas.set(id, (deltas.get(id) ?? 0) + d);

    for (const rule of this.registry.getRules()) {
      const src = this.registry.getAxis(rule.source);
      if (!src) continue;
      const mid = (src.min + src.max) / 2;
      const threshold = rule.threshold ?? mid;
      add(rule.target, (this.get(rule.source) - threshold) * rule.factor);
    }

    for (const ax of this.registry.getAxes()) {
      add(ax.id, (ax.baseline - this.get(ax.id)) * ax.drift);
    }

    if (jitter > 0) {
      for (const ax of this.registry.getAxes()) {
        add(ax.id, (rand() * 2 - 1) * jitter);
      }
    }

    for (const [id, d] of deltas) this.set(id, this.get(id) + d);

    const out: Record<string, number> = {};
    for (const [id, d] of deltas) out[id] = Math.round(d * 100) / 100;
    this.notify();
    return { deltas: out };
  }

  public snapshot(): Record<string, number> {
    return Object.fromEntries(this.values);
  }

  public restore(snap: Record<string, number>): void {
    for (const ax of this.registry.getAxes()) {
      const v = snap[ax.id];
      this.values.set(
        ax.id,
        v === undefined ? ax.initial : Math.max(ax.min, Math.min(ax.max, v)),
      );
    }
    this.notify();
  }
}
