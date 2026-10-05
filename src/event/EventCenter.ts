import { z } from "zod";
import { Incident } from "../world/Incident.js";

const rangeSchema = z
  .string()
  .regex(/^\d+-\d+$/)
  .refine(
    (val) => {
      const [start, end] = val.split("-").map(Number);
      return start < end;
    },
    {
      message: "键名必须为 '数字-数字' 格式，且起始数字必须小于结束数字",
    },
  );

export default class EventCenter {
  private eventMap: Map<string, Set<Incident>> = new Map();
  private incidentById: Map<string, Incident> = new Map();

  public add(rangeKey: string, incident: Incident): void {
    rangeSchema.parse(rangeKey);
    const existing = this.incidentById.get(incident.id);
    if (existing) {
      if (existing !== incident) {
        throw new Error(`事件 ID "${incident.id}" 被不同实例重复注册`);
      }
    } else {
      this.incidentById.set(incident.id, incident);
    }

    if (!this.eventMap.has(rangeKey)) {
      this.eventMap.set(rangeKey, new Set());
    }
    this.eventMap.get(rangeKey)!.add(incident);
  }

  public remove(rangeKey: string, incidentId: string): void {
    const set = this.eventMap.get(rangeKey);
    if (set) {
      for (const item of set) {
        if (item.id === incidentId) {
          set.delete(item);
          break;
        }
      }
    }
    // Keep the id→incident index in sync, but only drop it once NO range still
    // holds the incident: WorldEventLoader registers one instance per range, so
    // removing it from one range must not hide it from the others (nor from
    // post-event resolution, which looks incidents up by id).
    if (!this.isRegisteredInAnyRange(incidentId)) {
      this.incidentById.delete(incidentId);
    }
  }

  private isRegisteredInAnyRange(incidentId: string): boolean {
    for (const incidents of this.eventMap.values()) {
      for (const item of incidents) {
        if (item.id === incidentId) return true;
      }
    }
    return false;
  }

  public getIncidentById(id: string): Incident | undefined {
    return this.incidentById.get(id);
  }

  public getAllRanges(): string[] {
    return Array.from(this.eventMap.keys());
  }

  public getIncidentsByRange(rangeKey: string): Set<Incident> | undefined {
    return this.eventMap.get(rangeKey);
  }

  public clear(): void {
    this.eventMap.clear();
    this.incidentById.clear();
  }
}
