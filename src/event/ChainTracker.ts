import type { PostIncidentConfig } from "../world/Incident.js";

/** Serializable state of every chain edge fired this life. */
export interface ChainArchive {
  firedEdges: string[];
  runs: Record<string, number>;
  firedGroups: string[];
}

/**
 * Runtime bookkeeping for post-event graphs: which edges have fired, how many
 * times, and which mutually-exclusive groups are spent. A container singleton so
 * a narrative line can continue across level (age-stage) boundaries.
 */
export default class ChainTracker {
  private firedEdges = new Set<string>();
  private runs = new Map<string, number>();
  private firedGroups = new Set<string>();

  /** Stable key for an edge, so `once` / `maxRuns` survive reordering. */
  public keyOf(sourceId: string, edge: PostIncidentConfig, index: number): string {
    const chain = edge.chainId ?? sourceId;
    const id = edge.edgeId ?? `${sourceId}#${edge.incident}`;
    return `${chain}:${id}:${index}`;
  }

  /** Whether an edge is still available (once / maxRuns / group + age window). */
  public isOpen(
    sourceId: string,
    edge: PostIncidentConfig,
    index: number,
    age: number,
  ): boolean {
    if (edge.minAge !== undefined && age < edge.minAge) return false;
    if (edge.maxAge !== undefined && age > edge.maxAge) return false;
    const key = this.keyOf(sourceId, edge, index);
    if (edge.once && this.firedEdges.has(key)) return false;
    if (edge.maxRuns !== undefined && (this.runs.get(key) ?? 0) >= edge.maxRuns) {
      return false;
    }
    if (edge.group && this.firedGroups.has(edge.group)) return false;
    return true;
  }

  /** Mark an edge as fired (called when its target actually executes). */
  public record(
    sourceId: string,
    edge: PostIncidentConfig,
    index: number,
  ): void {
    const key = this.keyOf(sourceId, edge, index);
    this.firedEdges.add(key);
    this.runs.set(key, (this.runs.get(key) ?? 0) + 1);
    if (edge.group) this.firedGroups.add(edge.group);
  }

  public reset(): void {
    this.firedEdges.clear();
    this.runs.clear();
    this.firedGroups.clear();
  }

  public snapshot(): ChainArchive {
    return {
      firedEdges: [...this.firedEdges],
      runs: Object.fromEntries(this.runs),
      firedGroups: [...this.firedGroups],
    };
  }

  public restore(archive: Partial<ChainArchive>): void {
    this.firedEdges = new Set(archive.firedEdges ?? []);
    this.runs = new Map(Object.entries(archive.runs ?? {}));
    this.firedGroups = new Set(archive.firedGroups ?? []);
  }
}
