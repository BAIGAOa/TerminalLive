import { Scope, Scoped } from "di-wise";
import JSONparsing from "../json/JSONparsing.js";
import ConfigSchema, {
  ConfigType,
  DEFAULT_PLAYER_CONFIG,
  PlayerConfigType,
} from "../../types/ConfigType.js";

type Listener = () => void;

@Scoped(Scope.Container)
export default class ConfigStore {
  private config: ConfigType = {
    language: "en_US",
    player: { ...DEFAULT_PLAYER_CONFIG },
    enabledMods: [],
  };
  private listeners: Set<Listener> = new Set();
  private jsonParser = new JSONparsing("config.json");

  /** 初始化从磁盘加载配置，必须在应用启动时调用 */
  public async init(): Promise<void> {
    try {
      this.config = await this.jsonParser.loadingConfig(ConfigSchema);
    } catch {
      console.warn("config.json 加载失败，使用默认配置");
    }
  }

  public getLanguage(): string {
    return this.config.language;
  }

  public async setLanguage(lang: string): Promise<void> {
    this.config = { ...this.config, language: lang };
    await this.persist();
    this.emitChange();
  }

  public getSnapshot = (): Readonly<ConfigType> => this.config;

  public async update(partial: Partial<ConfigType>): Promise<void> {
    this.config = { ...this.config, ...partial };
    await this.persist();
    this.emitChange();
  }

  private async persist(): Promise<void> {
    try {
      await this.jsonParser.saveConfig(this.config, ConfigSchema);
    } catch (err) {
      console.error("配置持久化失败:", err);
    }
  }

  public subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emitChange(): void {
    this.listeners.forEach((fn) => fn());
  }

  public getPlayerConfig(): PlayerConfigType {
    return this.config.player ?? {};
  }

  //更新配置然后持久化
  public async setPlayerConfig(
    partial: Partial<PlayerConfigType>,
  ): Promise<void> {
    //更新配置
    this.config = {
      ...this.config,
      player: { ...this.config.player, ...partial },
    };
    await this.persist();
    this.emitChange();
  }

  //获取已启用的 mod 列表
  public getEnabledMods(): string[] {
    return this.config.enabledMods ?? [];
  }

  //设置已启用的 mod 列表并持久化
  public async setEnabledMods(mods: string[]): Promise<void> {
    this.config = { ...this.config, enabledMods: mods };
    await this.persist();
    this.emitChange();
  }
}
