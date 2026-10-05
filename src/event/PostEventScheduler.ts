import Player from "../world/Player.js"
import type { PostIncidentConfig } from "../world/Incident.js"

export interface PendingPostEvent {
    sourceId: string
    targetId: string
    delay: number
    weight?: number
    condition?: (player: Player) => boolean
    /** The graph edge that produced this item (for once/maxRuns/group tracking). */
    edge?: PostIncidentConfig
    /** Index of `edge` within its source's `postEvent` list. */
    edgeIndex?: number
}

/**
 * Serializable form of a queued post event. Deliberately closure-free: the
 * runtime `edge` / `condition` are re-resolved from content at fire time via
 * `{ sourceId, edgeIndex }`, so a save never has to serialize functions.
 */
export interface SerializedPendingPostEvent {
    sourceId: string
    targetId: string
    delay: number
    weight?: number
    /** Index into the source incident's `postEvent` array (absent for string edges). */
    edgeIndex?: number
}

/**
 * Queues post-event graph steps so a narrative line can continue on later
 * rounds (and across save/load, see `snapshot` / `restore`).
 *
 * Delay semantics: an item scheduled with `delay = D` waits D rounds and then
 * fires on the **(D+1)-th** subsequent `advanceRound()` call. `delay = 0`
 * therefore fires on the very next round (the existing "next round
 * immediately" behaviour of a bare string `postEvent`); `delay = 2` skips two
 * rounds and fires on the third. Scheduling happens mid-round, after the source
 * event has already resolved, so "next round" is the earliest possible slot.
 */
export default class PostEventScheduler {
    private pending: PendingPostEvent[] = [];

    public add(event: PendingPostEvent): void {
        // Normalize a negative/NaN delay to zero so it cannot get stuck forever.
        const delay = Number.isFinite(event.delay) && event.delay > 0
            ? Math.floor(event.delay)
            : 0;
        this.pending.push({ ...event, delay });
    }

    public advanceRound(): PendingPostEvent[] {
        const toTrigger: PendingPostEvent[] = [];
        const remaining: PendingPostEvent[] = [];

        for (const item of this.pending) {
            if (item.delay <= 0) {
                toTrigger.push(item);
            } else {
                remaining.push({ ...item, delay: item.delay - 1 });
            }
        }

        this.pending = remaining;
        return toTrigger;
    }

    /** Closure-free snapshot of the queue, safe to persist in a save. */
    public snapshot(): SerializedPendingPostEvent[] {
        return this.pending.map((item) => ({
            sourceId: item.sourceId,
            targetId: item.targetId,
            delay: item.delay,
            weight: item.weight,
            edgeIndex: item.edgeIndex,
        }));
    }

    /**
     * Restore a queued set from a save. Only non-closure fields are read; the
     * caller re-resolves `edge` / `condition` at fire time.
     */
    public restore(items: SerializedPendingPostEvent[]): void {
        this.pending = (items ?? []).map((item) => ({
            sourceId: item.sourceId,
            targetId: item.targetId,
            delay:
                Number.isFinite(item.delay) && item.delay > 0
                    ? Math.floor(item.delay)
                    : 0,
            weight: item.weight,
            edgeIndex: item.edgeIndex,
        }));
    }

    /** Number of items currently queued (for tests / diagnostics). */
    public size(): number {
        return this.pending.length;
    }

    public reset(): void {
        this.pending = [];
    }
}
