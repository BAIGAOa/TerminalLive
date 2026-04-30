import { Scope, Scoped } from "di-wise";

@Scoped(Scope.Container)
export default class EventHistory {
    private triggered: Set<string> = new Set();
    private blocked: Set<string> = new Set();
    private rangeRecord: Map<string, Set<string>> = new Map();

    public markTriggered(incidentId: string, rangeKey: string): void {
        this.triggered.add(incidentId);
        if (!this.rangeRecord.has(incidentId)) {
            this.rangeRecord.set(incidentId, new Set());
        }
        this.rangeRecord.get(incidentId)!.add(rangeKey);
    }

    public markBlocked(incidentIds: string[]): void {
        incidentIds.forEach(id => this.blocked.add(id));
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
        return this.triggered
    }

    public getBlocked() {
        return this.blocked
    }

    public getRangeKeyRecord() {
        return this.rangeRecord
    }
}
