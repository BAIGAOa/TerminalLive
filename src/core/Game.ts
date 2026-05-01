import { Scope, Scoped } from "di-wise";
import Player from "../world/Player.js";
import { container } from "../Container.js";
import EventAlgorithm from "../event/EventAlgorithm.js";
import EventBus from "./EventBus.js";
import ModPluginLoader from "./mod/ModPluginLoader.js";

@Scoped(Scope.Container)
export default class Game {
  private isInit: boolean = false;
  private _player: Player | null = null;

  public get player(): Player {
    if (!this._player) {
      throw new Error("游戏未初始化，请调用Game的init方法");
    }
    return this._player;
  }

  public init(player: Player) {
    if (!this.isInit) {
      this.isInit = true;

      this._player = player;
    }
  }

  public update() {
    this.player.update();
    container.resolve(EventAlgorithm).trigger(this.player);
    container.resolve(EventBus).emit("player:updated");
    container.resolve(ModPluginLoader).firePlayerUpdate(this.player);
  }
}
