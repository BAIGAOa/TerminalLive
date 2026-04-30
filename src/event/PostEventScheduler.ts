import Player from "../world/Player.js"

export interface PendingPostEvent {
    sourceId: string
    targetId: string
    delay: number
    weight?: number
    condition?: (player: Player) => boolean
}


export default class PostEventScheduler {
    private pending: PendingPostEvent[] = [];

    public add(event: PendingPostEvent): void {
        this.pending.push(event);
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

    public reset(): void {
        this.pending = [];
    }
}
