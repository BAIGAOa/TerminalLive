import { MsgKind, ScrollLine } from "./types.js";

type Listener = () => void;

/** The terminal scrollback, consumed with `useSyncExternalStore`. */
export default class ReplStore {
  private lines: ScrollLine[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;
  private cached: readonly ScrollLine[] | null = null;
  private readonly MAX = 500;

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): readonly ScrollLine[] => {
    if (!this.cached) this.cached = this.lines;
    return this.cached;
  };

  public append(text: string, kind: MsgKind = "info"): void {
    const line: ScrollLine = { id: ++this.seq, kind, text };
    const next = [...this.lines, line];
    this.lines = next.length > this.MAX ? next.slice(-this.MAX) : next;
    this.cached = null;
    this.emit();
  }

  public clear(): void {
    if (this.lines.length === 0) return;
    this.lines = [];
    this.cached = null;
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}
