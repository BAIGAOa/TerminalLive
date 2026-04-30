import Player from "./Player.js";

export interface IncidentParameter {
  id?: string;
  rangeKey?: string[];
  nameKey?: string;
  weight?: number;
  predecessorEvent?: string;
  excludedIds?: string[];

  once?: boolean | string[];
  postEvent?: string | PostIncidentConfig[];

  params?: Record<string, unknown>;
}

export interface PostIncidentConfig {
  incident: string;
  delay?: number;
  weight?: number;
  triggerCondition?: (player: Player) => boolean;
}

export abstract class Incident {
  /** 事件的唯一标识 */
  public id: string = "defaultId";
  /** 事件的触发阶段*/
  public rangeKey: string[] = ["0-100"];
  /** 语言包里对应的翻译键值*/
  public nameKey: string | null = null;
  /** 出现概率权重，数值越高概率越大 */
  public weight: number = 0.5;
  /** 事件触发时的具体影响逻辑 */
  public abstract apply(player: Player): void;

  /** 前置事件 前面历史必须要发生过什么事件才可以触发此事件*/
  public predecessorEvent: string | null = null;

  /** 与哪些事件互斥 如果与选中的事件互斥 当此事件触发时 被选中的事件将不再拥有
   * 被选中的资格 即使这个事件确实处于正确的阶段
   */
  public excludedIds: string[] = [];

  /** 事件是否只触发一次 当此属性为false时 事件会重复触发 默认为false
   * 当once不为布尔值时，则必须为一个字符串数组，字符串格式为'小的数字-大的数字'
   * 这个将会通过zod进行验证
   * 这时，就表示此事件只在特定的哪些阶段中保持唯一性
   * 如果此类设置了后置事件，那么任何的后置事件被触发后将全部都是全局唯一
   */
  public once: boolean | string[] = false;
  /**
   * 事件触发后会触发的事件
   * 如果是只填一个事件id，就代表这个事件发生后，下一回合会立即触发指定的事件
   * 如果是一个数组，就会根据配置对象，来规定条件等
   */
  public postEvent: string | PostIncidentConfig[] | null = null;

  constructor(parmater: IncidentParameter) {
    this.setup(parmater);
  }

  protected setup(parameter: IncidentParameter) {
    this.id = parameter.id ?? this.id;
    this.rangeKey = parameter.rangeKey ?? this.rangeKey;
    this.weight = parameter.weight ?? this.weight;
    this.predecessorEvent = parameter.predecessorEvent ?? this.predecessorEvent;
    this.excludedIds = parameter.excludedIds ?? this.excludedIds;
    this.once = parameter.once ?? this.once;
    this.postEvent = parameter.postEvent ?? this.postEvent;
    this.nameKey = parameter.nameKey ?? this.nameKey;
  }

  /**
   * 动态改变权重，可以根据玩家属性动态改变权重
   * 默认返回静态的自身权重
   */
  public getWeight(_player: Player): number {
    return this.weight;
  }
}
