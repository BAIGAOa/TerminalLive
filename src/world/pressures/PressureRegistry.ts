import { PressureDefinition } from "./PressureDefinition.js";
import { PressureRule } from "./PressureRule.js";

/** A serialisable snapshot of all pressure axes and rules. */
export interface PressureSnapshot {
  axes: Array<[string, PressureDefinition]>;
  rules: PressureRule[];
}

/** Holds every pressure axis and the coupling rules between them. */
export default class PressureRegistry {
  private axes = new Map<string, PressureDefinition>();
  private rules: PressureRule[] = [];

  public registerAxis(def: PressureDefinition): void {
    if (this.axes.has(def.id)) {
      throw new Error(`隐藏分 ID 重复: ${def.id}`);
    }
    this.axes.set(def.id, def);
  }

  public registerRule(rule: PressureRule): void {
    this.rules.push(rule);
  }

  /** Drop rules that reference unknown axes (defensive; also used in tests). */
  public pruneInvalidRules(): void {
    this.rules = this.rules.filter(
      (r) => this.axes.has(r.source) && this.axes.has(r.target),
    );
  }

  public getAxis(id: string): PressureDefinition | undefined {
    return this.axes.get(id);
  }

  public hasAxis(id: string): boolean {
    return this.axes.has(id);
  }

  public getAxes(): PressureDefinition[] {
    return [...this.axes.values()];
  }

  public getRules(): PressureRule[] {
    return this.rules;
  }

  // ── resettable (World content layering) ────────────────────────
  public snapshot(): PressureSnapshot {
    return { axes: [...this.axes.entries()], rules: [...this.rules] };
  }

  public restore(snap: PressureSnapshot): void {
    this.axes = new Map(snap.axes);
    this.rules = [...snap.rules];
  }

  public clear(): void {
    this.axes = new Map();
    this.rules = [];
  }
}
