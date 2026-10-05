import JSONparsing from "../json/JSONparsing.js";
import LevelRecordsSchema, {
  DEFAULT_LEVEL_RECORDS,
  LevelRecord,
  LevelRecordsState,
} from "../../types/WorldRecordType.js";

type Listener = () => void;

/**
 * Cross-life meta-progression for levels: how often each was completed, the
 * best score, and which optional objectives ("medals") were ever earned. Kept
 * apart from the per-life `completedLevels` in config, and from the save.
 */
export default class WorldRecordsStore {
  private state: LevelRecordsState = { ...DEFAULT_LEVEL_RECORDS, levels: {} };
  private listeners: Set<Listener> = new Set();
  private version = 0;

  constructor(private json: JSONparsing = new JSONparsing("levels_progress.json")) {}

  public async init(): Promise<void> {
    try {
      this.state = await this.json.loadingConfig(LevelRecordsSchema);
    } catch {
      this.state = { ...DEFAULT_LEVEL_RECORDS, levels: {} };
    }
    this.emitChange();
  }

  public getRecord(levelId: string): LevelRecord {
    return (
      this.state.levels[levelId] ?? {
        completions: 0,
        medals: [],
        bestScore: 0,
        lastOutcome: null,
      }
    );
  }

  public getSnapshot = (): number => this.version;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public async recordCompletion(
    levelId: string,
    score: number,
    outcome: "death" | "complete",
  ): Promise<void> {
    const prev = this.getRecord(levelId);
    this.setRecord(levelId, {
      ...prev,
      completions: prev.completions + 1,
      bestScore: Math.max(prev.bestScore, score),
      lastOutcome: outcome,
    });
    await this.persist();
  }

  public async addMedal(levelId: string, medalId: string): Promise<void> {
    const prev = this.getRecord(levelId);
    if (prev.medals.includes(medalId)) return;
    this.setRecord(levelId, { ...prev, medals: [...prev.medals, medalId] });
    await this.persist();
  }

  private setRecord(levelId: string, record: LevelRecord): void {
    this.state = {
      ...this.state,
      levels: { ...this.state.levels, [levelId]: record },
    };
    this.emitChange();
  }

  private async persist(): Promise<void> {
    try {
      await this.json.saveConfig(this.state, LevelRecordsSchema);
    } catch (err) {
      console.error("levels_progress.json 持久化失败:", err);
    }
  }

  private emitChange(): void {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }
}
