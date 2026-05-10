import { Scope, Scoped } from "di-wise";
import { container } from "../../Container.js";
import TypedEventBus from "../TypedEventBus.js";

type Listener = () => void;

export interface ConsoleNotification {
  id: string;
  type: "achievement" | "mod" | "archive" | "catalogCreation";
  messageKey: string;
  timestamp: string;
}

export interface ConsoleCommandResult {
  id: string;
  type: "success" | "error" | "info";
  /** 原始消息（直接显示，不经翻译） */
  message?: string;
  /** 翻译 key */
  messageKey?: string;
  /** 翻译参数 */
  messageParams?: Record<string, string | number>;
}

export interface ConsoleSnapshot {
  readonly visible: boolean;
  readonly notifications: readonly ConsoleNotification[];
  readonly unreadCount: number;
  readonly inputMode: boolean;
  readonly inputText: string;
  readonly commandResults: readonly ConsoleCommandResult[];
}

@Scoped(Scope.Container)
export default class ConsoleStore {
  private notifications: ConsoleNotification[] = [];
  private commandResults: ConsoleCommandResult[] = [];
  private visible: boolean = false;
  private unreadCount: number = 0;
  private inputMode: boolean = false;
  private inputText: string = "";
  private listeners: Set<Listener> = new Set();
  private cachedSnapshot: ConsoleSnapshot | null = null;
  private resultIdCounter = 0;

  private readonly MAX_NOTIFICATIONS = 20;
  private readonly MAX_COMMAND_RESULTS = 50;

  constructor() {
    const eventBus = container.resolve(TypedEventBus);

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

    eventBus.on("level:loadFailed", (data) => {
      this.addNotification({
        id: data.levelId,
        type: "archive",
        messageKey: data.levelId,
        timestamp: new Date().toLocaleString(),
      });
    });

    eventBus.on("archive:failedCreateFolder", (data) => {
      this.addNotification({
        id: data.id,
        type: "catalogCreation",
        messageKey: data.id,
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
        inputMode: this.inputMode,
        inputText: this.inputText,
        commandResults: this.commandResults,
      };
    }
    return this.cachedSnapshot;
  };

  

  public toggle(): void {
    this.visible = !this.visible;
    if (this.visible) {
      this.unreadCount = 0;
    } else {
      // 关闭控制台时退出输入模式
      this.inputMode = false;
      this.inputText = "";
    }
    this.emitChange();
  }

  

  private addNotification(notification: ConsoleNotification): void {
    this.notifications = [notification, ...this.notifications].slice(
      0,
      this.MAX_NOTIFICATIONS,
    );
    if (!this.visible) {
      this.unreadCount++;
    }
    this.emitChange();
  }

  

  public enterInputMode(): void {
    if (!this.visible) return;
    this.inputMode = true;
    this.inputText = "";
    this.emitChange();
  }

  public exitInputMode(): void {
    this.inputMode = false;
    this.inputText = "";
    this.emitChange();
  }

  public setInputText(text: string): void {
    this.inputText = text;
    this.emitChange();
  }

  

  public addCommandResult(
    result: Omit<ConsoleCommandResult, "id">,
  ): void {
    const id = `cmd-${++this.resultIdCounter}`;
    this.commandResults = [
      { ...result, id },
      ...this.commandResults,
    ].slice(0, this.MAX_COMMAND_RESULTS);
    this.emitChange();
  }

  public clearCommandResults(): void {
    this.commandResults = [];
    this.emitChange();
  }

  

  private emitChange(): void {
    this.cachedSnapshot = null;
    this.listeners.forEach((fn) => fn());
  }
}