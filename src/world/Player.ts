import { clamp } from "lodash-es";

export type StateEffectFn = (player: Player) => void;

export interface PlayerAttributes {
  playerName?: string;
  age?: number;
  health?: number;
  height?: number;
  weight?: number;

  angerValue?: number;
  excitationValue?: number;
  depressionValue?: number;
  weakValue?: number;

  fortune?: number;
}

export default class Player {
  /** 玩家的名称 */
  public playerName: string;
  /** 玩家的年龄 */
  public age: number;
  /** 玩家的健康值 */
  public health: number;
  /** 玩家的身高 */
  public height: number;
  /** 玩家的体重 */
  public weight: number;

  /** 玩家的生气值 */
  public angerValue: number;
  /** 玩家的兴奋值 */
  public excitationValue: number;
  /** 玩家的抑郁值*/
  public depressionValue: number;
  /** 玩家的虚弱值*/
  public weakValue: number;

  /** 玩家的财富与金钱 */
  public fortune: number;

  public anger: boolean = false;
  public excitement: boolean = false;
  public weakness: boolean = false;
  public depression: boolean = false;

  private readonly THRESHOLD = 70;
  private readonly MAX_VALUE = 100;

  private policyPool: Record<string, StateEffectFn> = {
    none: (_p) => {},
  };

  public currentStatus: string = "none";

  private listeners = new Set<() => void>();

  constructor(attrs: PlayerAttributes) {
    this.playerName = attrs.playerName || "You";
    this.age = attrs.age || 0;
    this.health = attrs.health || 100;
    this.height = attrs.height || 1.55;
    this.weight = attrs.weight || 45;

    this.angerValue = attrs.angerValue || 0;
    this.excitationValue = attrs.excitationValue || 0;
    this.depressionValue = attrs.depressionValue || 0;
    this.weakValue = attrs.weakValue || 0;

    this.fortune = attrs.fortune || 0;

    this.defaultEffect();
    this.checkAndApplyStates();
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  public notify() {
    this.listeners.forEach((fn) => fn());
  }

  /**
   * 状态仲裁与互斥
   */
  private checkAndApplyStates(): void {
    // 重置所有状态
    this.anger = false;
    this.excitement = false;
    this.weakness = false;
    this.depression = false;

    const states = [
      {
        id: "anger",
        value: this.angerValue,
      },
      {
        id: "excitement",
        value: this.excitationValue,
      },
      {
        id: "depression",
        value: this.depressionValue,
      },
      {
        id: "weakness",
        value: this.weakValue,
      },
    ];

    // 找到数值最高的一个
    const topState = states.sort((a, b) => b.value - a.value)[0];

    // 仅当最高值超过门槛时激活该唯一状态
    if (topState.value >= this.THRESHOLD) {
      this.currentStatus = topState.id;
      if (topState.id in this) {
        (this as any)[topState.id] = true;
      }
    } else {
      this.currentStatus = "none";
    }
  }

  /**
   * 状态副作用处理
   */
  private applyStateEffects(): void {
    const effectFn =
      this.policyPool[this.currentStatus] || this.policyPool.none;

    effectFn(this);

    this.clampValues();
  }

  private clampValues(): void {
    // clamp(value, lower, upper)
    this.angerValue = clamp(this.angerValue, 0, this.MAX_VALUE);
    this.excitationValue = clamp(this.excitationValue, 0, this.MAX_VALUE);
    this.depressionValue = clamp(this.depressionValue, 0, this.MAX_VALUE);
    this.weakValue = clamp(this.weakValue, 0, this.MAX_VALUE);
    this.health = clamp(this.health, 0, this.MAX_VALUE);
  }

  /**默认的策略模式*/
  private defaultEffect(): void {
    this.addPolicy("anger", (p) => {
      p.health -= 2;
      p.angerValue -= 1;
    });
    this.addPolicy("depression", (p) => {
      p.health -= 0.2;
      p.weakValue += 1;
    });
    this.addPolicy("excitement", (p) => {
      p.health += 1;
      p.weakValue -= 2;
    });
    this.addPolicy("weakness", (p) => {
      p.health -= 1;
    });
  }

  /**
   * 增加愤怒值
   */
  public irritate(amount: number): void {
    this.angerValue += amount;
    // 愤怒会抵消一部分抑郁
    this.depressionValue -= amount / 2;
    this.checkAndApplyStates();
  }

  public update(): void {
    this.age += 1;
    this.applyStateEffects();
    this.checkAndApplyStates();
    this.notify(); // 通知 UI 刷新
  }

  /** 添加一个策略 */
  public addPolicy(attributeName: string, operate: (player: Player) => void) {
    this.policyPool[attributeName] = operate;
  }

  // 批量应用属性
  // 这会用于玩家属性配置
  public applyAttributes(attrs: Partial<PlayerAttributes>): void {
    if (attrs.playerName !== undefined) this.playerName = attrs.playerName;
    if (attrs.age !== undefined) this.age = attrs.age;
    if (attrs.health !== undefined) this.health = attrs.health;
    if (attrs.height !== undefined) this.height = attrs.height;
    if (attrs.weight !== undefined) this.weight = attrs.weight;
    if (attrs.angerValue !== undefined) this.angerValue = attrs.angerValue;
    if (attrs.excitationValue !== undefined)
      this.excitationValue = attrs.excitationValue;
    if (attrs.depressionValue !== undefined)
      this.depressionValue = attrs.depressionValue;
    if (attrs.weakValue !== undefined) this.weakValue = attrs.weakValue;
    if (attrs.fortune !== undefined) this.fortune = attrs.fortune;

    //限制玩家的属性在正常范围
    this.clampValues();
    //进行属性仲裁
    this.checkAndApplyStates();
  }
}
