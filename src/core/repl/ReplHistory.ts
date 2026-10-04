/** Up/down command history for the terminal input. */
export default class ReplHistory {
  private entries: string[] = [];
  /** -1 = editing a fresh line; otherwise an index from the end. */
  private cursor = -1;
  private readonly max = 200;

  public push(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (this.entries[this.entries.length - 1] !== trimmed) {
      this.entries.push(trimmed);
      if (this.entries.length > this.max) this.entries.shift();
    }
    this.cursor = -1;
  }

  public reset(): void {
    this.cursor = -1;
  }

  /** Older entry (↑). Returns null when there is nothing older. */
  public prev(): string | null {
    if (this.entries.length === 0) return null;
    if (this.cursor === -1) this.cursor = this.entries.length - 1;
    else if (this.cursor > 0) this.cursor--;
    else return this.entries[0];
    return this.entries[this.cursor];
  }

  /** Newer entry (↓). Returns null when back at the fresh line. */
  public next(): string | null {
    if (this.cursor === -1) return null;
    if (this.cursor < this.entries.length - 1) {
      this.cursor++;
      return this.entries[this.cursor];
    }
    this.cursor = -1;
    return null;
  }

  public all(): string[] {
    return [...this.entries];
  }
}
