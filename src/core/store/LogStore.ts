import { Incident } from "../../world/Incident.js";

type Listener = () => void;

export interface LogEntry {
  incident: Incident;
  timestamp: Date;
}

export default class LogStore {
  private entries: LogEntry[] = [];
  private listeners = new Set<Listener>();
  private readonly MAX_Events = 15;

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = () => this.entries;

  public addEvent(event: Incident): void {
    const entry: LogEntry = {
      incident: event,
      timestamp: new Date(),
    };
    this.entries = [entry, ...this.entries].slice(0, this.MAX_Events);
    this.listeners.forEach((fn) => fn());
  }
}
