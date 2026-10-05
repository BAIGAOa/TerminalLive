export default class EventHistory {
  private triggered: Set<string> = new Set();
  private blocked: Set<string> = new Set();
  private rangeRecord: Map<string, Set<string>> = new Map();
  /** incidentId → age at which it last fired (for cooldown). */
  private triggeredAge: Map<string, number> = new Map();
  /** category → age at which any member last fired (same-class decay). */
  private categoryAge: Map<string, number> = new Map();
  /** The most recently fired incident and how many years in a row it has fired. */
  private lastId: string | null = null;
  private consecutiveCount = 0;

  public markTriggered(
    incidentId: string,
    rangeKey: string,
    age?: number,
    category?: string | null,
  ): void {
    this.triggered.add(incidentId);
    if (!this.rangeRecord.has(incidentId)) {
      this.rangeRecord.set(incidentId, new Set());
    }
    this.rangeRecord.get(incidentId)!.add(rangeKey);
    if (age !== undefined) {
      this.triggeredAge.set(incidentId, age);
      if (category) this.categoryAge.set(category, age);
    }
    if (incidentId === this.lastId) {
      this.consecutiveCount++;
    } else {
      this.lastId = incidentId;
      this.consecutiveCount = 1;
    }
  }

  /** Age at which `incidentId` last fired, or undefined if it never has. */
  public lastTriggeredAge(incidentId: string): number | undefined {
    return this.triggeredAge.get(incidentId);
  }

  /** Age at which any event of `category` last fired, or undefined. */
  public lastCategoryAge(category: string): number | undefined {
    return this.categoryAge.get(category);
  }

  /** How many consecutive years `incidentId` has fired (0 if not the last). */
  public consecutiveCountOf(incidentId: string): number {
    return incidentId === this.lastId ? this.consecutiveCount : 0;
  }

  public markBlocked(incidentIds: string[]): void {
    incidentIds.forEach((id) => this.blocked.add(id));
  }

  public isTriggered(incidentId: string): boolean {
    return this.triggered.has(incidentId);
  }

  public isBlocked(incidentId: string): boolean {
    return this.blocked.has(incidentId);
  }

  public hasTriggeredInRange(incidentId: string, rangeKey: string): boolean {
    const ranges = this.rangeRecord.get(incidentId);
    return ranges ? ranges.has(rangeKey) : false;
  }

  public reset(): void {
    this.triggered.clear();
    this.blocked.clear();
    this.rangeRecord.clear();
    this.triggeredAge.clear();
    this.categoryAge.clear();
    this.lastId = null;
    this.consecutiveCount = 0;
  }

  public getTriggered() {
    return this.triggered;
  }

  public getBlocked() {
    return this.blocked;
  }

  public getRangeKeyRecord() {
    return this.rangeRecord;
  }

  /**
   * DEPRECATED no-op. History persistence is owned solely by SaveCodec /
   * AutoSave (see `toArchiveData` / `restoreFromArchive`). The old
   * `resource/history.json` file path was vestigial: it was written only on a
   * save load (via `WorldManager.restoreWorld`) and read once at boot, i.e. it
   * mutated a repo-tracked file at runtime while the authoritative state lived
   * in the save blob. The methods are kept as no-ops so existing callers
   * (`GameInitialization.init`, `WorldManager.restoreWorld`) still compile.
   */
  public save(): void {
    /* no-op — see class docs; persistence goes through the save codec. */
  }

  /** DEPRECATED no-op — see {@link save}. State is restored from the save blob. */
  public load(): void {
    /* no-op — see save(). */
  }

  /** Serializable form shared by `save()` and the archive codec. */
  public toArchiveData(): {
    triggered: string[];
    blocked: string[];
    rangeRecord: Record<string, string[]>;
    triggeredAge: Record<string, number>;
    categoryAge: Record<string, number>;
    lastId: string | null;
    consecutiveCount: number;
  } {
    return {
      triggered: Array.from(this.triggered),
      blocked: Array.from(this.blocked),
      rangeRecord: this.serializeRangeRecord(),
      triggeredAge: Object.fromEntries(this.triggeredAge),
      categoryAge: Object.fromEntries(this.categoryAge),
      lastId: this.lastId,
      consecutiveCount: this.consecutiveCount,
    };
  }

  public restoreFromArchive(data: {
    triggered: string[];
    blocked: string[];
    rangeRecord: Record<string, string[]>;
    triggeredAge?: Record<string, number>;
    categoryAge?: Record<string, number>;
    lastId?: string | null;
    consecutiveCount?: number;
  }): void {
    this.triggered = new Set(data.triggered);
    this.blocked = new Set(data.blocked);
    this.rangeRecord = new Map();
    for (const [key, arr] of Object.entries(data.rangeRecord)) {
      this.rangeRecord.set(key, new Set(arr));
    }
    this.triggeredAge = new Map(Object.entries(data.triggeredAge ?? {}));
    this.categoryAge = new Map(Object.entries(data.categoryAge ?? {}));
    this.lastId = data.lastId ?? null;
    this.consecutiveCount = data.consecutiveCount ?? 0;
  }

  private serializeRangeRecord(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, set] of this.rangeRecord) {
      result[key] = Array.from(set);
    }
    return result;
  }
}
