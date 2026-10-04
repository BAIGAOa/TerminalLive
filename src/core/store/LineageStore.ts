import JSONparsing from "../json/JSONparsing.js";
import LineageSchema, {
  DEFAULT_LINEAGE_STATE,
  LINEAGE_HISTORY_CAP,
  LineageRecord,
  LineageState,
} from "../../types/LineageType.js";

type Listener = () => void;

/**
 * The family line, persisted across lives in `resource/lineage.json`. Mirrors
 * {@link ConfigStore}: lazy container singleton, immutable reassign → persist →
 * emit. Separate from the save schema so save-format changes never touch it.
 */
export default class LineageStore {
  private state: LineageState = { ...DEFAULT_LINEAGE_STATE, history: [] };
  private listeners: Set<Listener> = new Set();
  private version = 0;

  constructor(private json: JSONparsing = new JSONparsing("lineage.json")) {}

  /** Load the file; a missing/corrupt file means "no ancestor yet". */
  public async init(): Promise<void> {
    try {
      this.state = await this.json.loadingConfig(LineageSchema);
    } catch {
      this.state = { ...DEFAULT_LINEAGE_STATE, history: [] };
    }
    this.emitChange();
  }

  public getHistory(): readonly LineageRecord[] {
    return this.state.history;
  }

  /** The most recent finished life — the ancestor the next life inherits from. */
  public getLast(): LineageRecord | null {
    return this.state.history.at(-1) ?? null;
  }

  /** Ordinal of the life in progress (and next to begin): founder = 1. */
  public getNextGeneration(): number {
    const last = this.getLast();
    return last ? last.generation + 1 : 1;
  }

  /**
   * Append a finished life. Idempotent for a repeated `generation` (e.g. a
   * double `game:over` emit) — it replaces the last slot instead of appending.
   */
  public async recordLife(record: LineageRecord): Promise<void> {
    const history = [...this.state.history];
    const last = history.at(-1);
    if (last && last.generation === record.generation) {
      history[history.length - 1] = record;
    } else {
      history.push(record);
    }
    this.state = { ...this.state, history: history.slice(-LINEAGE_HISTORY_CAP) };
    await this.persist();
    this.emitChange();
  }

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): number => this.version;

  private async persist(): Promise<void> {
    try {
      await this.json.saveConfig(this.state, LineageSchema);
    } catch (err) {
      console.error("lineage.json 持久化失败:", err);
    }
  }

  private emitChange(): void {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }
}
