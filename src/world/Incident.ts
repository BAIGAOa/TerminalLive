import Player from "./Player.js";
import { ChoiceDef } from "./choices.js";
import type { WorldGate } from "./chronicle/WorldFilter.js";
import type { PressureGate, PressureBias } from "./pressures/PressureFilter.js";
import type { WeatherGate, WeatherBias } from "./weather/WeatherFilter.js";

export interface IncidentParameter {
  id?: string;
  rangeKey?: string[];
  nameKey?: string;
  /** Narrative text shown with the event / its choice prompt. */
  textKey?: string;
  /** When present the event pauses and offers the player these branches. */
  choices?: ChoiceDef[];
  /** Only eligible when the world state satisfies this gate. */
  worldGate?: WorldGate | null;
  /** Only eligible when the hidden-score axes satisfy this gate. */
  pressureGate?: PressureGate | null;
  /** Soft weight multipliers for the hidden-score axes. */
  pressureBias?: PressureBias[] | null;
  /** Only eligible under this weather. */
  weatherGate?: WeatherGate | null;
  /** Soft weight multipliers for the weather. */
  weatherBias?: WeatherBias[] | null;
  weight?: number;
  predecessorEvent?: string;
  excludedIds?: string[];

  /**
   * Soft cooldown (years): once this event fires, its weight drops to 0 for
   * this many years, so it cannot repeat back-to-back.
   */
  cooldown?: number;
  /** Semantic tags the director reads (e.g. "heal", "boon", "challenge"). */
  tags?: string[];
  /** Optional event class for same-class anti-repeat decay. */
  category?: string;

  once?: boolean | string[];
  postEvent?: string | PostIncidentConfig[];

  params?: Record<string, unknown>;

  /**
   * Who raised this incident. Defaults to the world (the event pool).
   * See {@link Incident.origin} for why the UI needs to know.
   */
  origin?: IncidentOrigin;
}

/**
 * A single edge in a post-event graph. An event's `postEvent` is a set of
 * edges; edges may be weighted, delayed, gated by age, marked `once`, capped by
 * `maxRuns`, and grouped (edges sharing a `group` are mutually exclusive).
 * Convergence falls out naturally: many sources may point at the same node.
 */
export interface PostIncidentConfig {
  incident: string;
  delay?: number;
  weight?: number;
  triggerCondition?: (player: Player) => boolean;
  /** Stable id used to track `once` / `maxRuns` across a life. */
  edgeId?: string;
  /** This edge may fire at most once per life. */
  once?: boolean;
  /** Cap how many times this edge's target may fire through this edge. */
  maxRuns?: number;
  /** Edges sharing a group are mutually exclusive — once one fires, the rest die. */
  group?: string;
  /** Narrative line this edge belongs to (defaults to the source event id). */
  chainId?: string;
  /** Only eligible while the player's age is within this window. */
  minAge?: number;
  maxAge?: number;
}

/** Where an incident came from. See {@link Incident.origin}. */
export type IncidentOrigin = "world" | "npc";

export abstract class Incident {
  /** 事件的唯一标识 */
  public id: string = "defaultId";
  /** 事件的触发阶段*/
  public rangeKey: string[] = ["0-100"];
  /** 语言包里对应的翻译键值*/
  public nameKey: string | null = null;
  /** 事件的叙述文本键 */
  public textKey: string | null = null;
  /** 事件提供的抉择分支（存在时暂停并等待玩家选择） */
  public choices: ChoiceDef[] | null = null;
  /** 世界状态门槛（时代/地域/势力）；不满足时不参与抽取 */
  public worldGate: WorldGate | null = null;
  /** 隐藏分门槛（不满足时不参与抽取） */
  public pressureGate: PressureGate | null = null;
  /** 隐藏分软权重（满足条件的轴会放大/缩小出现概率） */
  public pressureBias: PressureBias[] | null = null;
  /** 天气门槛（仅在特定天气下可触发） */
  public weatherGate: WeatherGate | null = null;
  /** 天气软权重 */
  public weatherBias: WeatherBias[] | null = null;
  /** 出现概率权重，数值越高概率越大 */
  public weight: number = 0.5;
  /** Soft cooldown in years: weight is 0 for this many years after firing. */
  public cooldown: number = 0;
  /** Semantic tags read by the director (heal/boon/challenge/…). */
  public tags: string[] = [];
  /** Event class for same-class anti-repeat decay (optional). */
  public category: string | null = null;
  /** 事件触发时的具体影响逻辑 */
  public abstract apply(player: Player): void;

  /**
   * Who raised this incident.
   *
   * `"world"` is the event pool — weather, chance, the world acting on the
   * player. `"npc"` is one of the cast acting on their own initiative (see
   * `NpcOfferIncident`). The two are answered in the same dialog, so the dialog
   * has to be able to say which it is: without this an NPC asking a favour
   * looks exactly like the world rolling an event.
   */
  public origin: IncidentOrigin = "world";

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
    this.origin = parameter.origin ?? this.origin;
    this.id = parameter.id ?? this.id;
    this.rangeKey = parameter.rangeKey ?? this.rangeKey;
    this.weight = parameter.weight ?? this.weight;
    this.cooldown = parameter.cooldown ?? this.cooldown;
    this.tags = parameter.tags ?? this.tags;
    this.category = parameter.category ?? this.category;
    this.predecessorEvent = parameter.predecessorEvent ?? this.predecessorEvent;
    this.excludedIds = parameter.excludedIds ?? this.excludedIds;
    this.once = parameter.once ?? this.once;
    this.postEvent = parameter.postEvent ?? this.postEvent;
    this.nameKey = parameter.nameKey ?? this.nameKey;
    this.textKey = parameter.textKey ?? this.textKey;
    this.choices = parameter.choices ?? this.choices;
    this.worldGate = parameter.worldGate ?? this.worldGate;
    this.pressureGate = parameter.pressureGate ?? this.pressureGate;
    this.pressureBias = parameter.pressureBias ?? this.pressureBias;
    this.weatherGate = parameter.weatherGate ?? this.weatherGate;
    this.weatherBias = parameter.weatherBias ?? this.weatherBias;
  }

  /** Whether this incident offers player choices. */
  public hasChoices(): boolean {
    return !!this.choices && this.choices.length > 0;
  }

  /**
   * 动态改变权重，可以根据玩家属性动态改变权重
   * 默认返回静态的自身权重
   */
  public getWeight(_player: Player): number {
    return this.weight;
  }
}
