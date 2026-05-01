import { Scope, Scoped } from "di-wise";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

@Scoped(Scope.Container)
export default class EventHistory {
  private triggered: Set<string> = new Set();
  private blocked: Set<string> = new Set();
  private rangeRecord: Map<string, Set<string>> = new Map();
  private readonly HISTORY_PATH = join(
    _dirname,
    "..",
    "..",
    "resource",
    "history.json",
  );

  public markTriggered(incidentId: string, rangeKey: string): void {
    this.triggered.add(incidentId);
    if (!this.rangeRecord.has(incidentId)) {
      this.rangeRecord.set(incidentId, new Set());
    }
    this.rangeRecord.get(incidentId)!.add(rangeKey);
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

  public save(): void {
    const data = {
      triggered: Array.from(this.triggered),
      blocked: Array.from(this.blocked),
      rangeRecord: this.serializeRangeRecord(),
    };
    writeFileSync(this.HISTORY_PATH, JSON.stringify(data, null, 2), "utf-8");
  }

  public load(): void {
    if (!existsSync(this.HISTORY_PATH)) return;
    try {
      const data = JSON.parse(readFileSync(this.HISTORY_PATH, "utf-8"));
      this.triggered = new Set(data.triggered ?? []);
      this.blocked = new Set(data.blocked ?? []);
      this.rangeRecord = new Map();
      for (const [key, arr] of Object.entries(
        (data.rangeRecord ?? {}) as Record<string, string[]>,
      )) {
        this.rangeRecord.set(key, new Set(arr));
      }
    } catch {
      /* 文件损坏则忽略 */
    }
  }

  public restoreFromArchive(data: {
    triggered: string[];
    blocked: string[];
    rangeRecord: Record<string, string[]>;
  }): void {
    this.triggered = new Set(data.triggered);
    this.blocked = new Set(data.blocked);
    this.rangeRecord = new Map();
    for (const [key, arr] of Object.entries(data.rangeRecord)) {
      this.rangeRecord.set(key, new Set(arr));
    }
  }

  private serializeRangeRecord(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, set] of this.rangeRecord) {
      result[key] = Array.from(set);
    }
    return result;
  }
}
