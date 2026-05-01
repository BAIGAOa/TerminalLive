import { Scope, Scoped } from "di-wise";
import { container } from "../../Container.js";
import EventBus from "../EventBus.js";

type Listener = () => void;

export interface ConsoleNotification {
  id: string;
  type: "achievement" | "mod";
  messageKey: string;
  timestamp: string;
}

export interface ConsoleSnapshot {
  readonly visible: boolean;
  readonly notifications: readonly ConsoleNotification[];
  readonly unreadCount: number;
}

@Scoped(Scope.Container)
export default class ConsoleStore {
  private notifications: ConsoleNotification[] = [];
  private visible: boolean = false;
  private unreadCount: number = 0;
  private listeners: Set<Listener> = new Set();
  private cachedSnapshot: ConsoleSnapshot | null = null;

  constructor() {
    const eventBus = container.resolve(EventBus);

    eventBus.on(
      "achievement:unlocked",
      (data: { id: string; remindKey: string }) => {
        this.addNotification({
          id: data.id,
          type: "achievement",
          messageKey: data.remindKey,
          timestamp: new Date().toLocaleString(),
        });
      },
    );

    eventBus.on("moder:loadSuccess", (data: { modName: string }) => {
      this.addNotification({
        id: data.modName,
        type: "mod",
        messageKey: data.modName,
        timestamp: new Date().toLocaleString(),
      });
    });
  }

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public getSnapshot = (): ConsoleSnapshot => {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = {
        visible: this.visible,
        notifications: this.notifications,
        unreadCount: this.unreadCount,
      };
    }
    return this.cachedSnapshot;
  };

  /** 切换控制台可见性 */
  public toggle(): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.unreadCount = 0;
    }
    this.emitChange();
  }

  /** 添加通知 */
  private addNotification(notification: ConsoleNotification): void {
    this.notifications = [notification, ...this.notifications].slice(0, 20);
    if (!this.visible) {
      this.unreadCount++;
    }
    this.emitChange();
  }

  private emitChange(): void {
    this.cachedSnapshot = null;
    this.listeners.forEach((fn) => fn());
  }
}
