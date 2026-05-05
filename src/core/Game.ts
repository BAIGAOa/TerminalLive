import { Scope, Scoped, inject } from "di-wise";
import Player from "../world/Player.js";
import LevelManager from "../level/LevelManager.js";

@Scoped(Scope.Container)
export default class Game {
  private levelManager: LevelManager;

  constructor() {
    this.levelManager = inject(LevelManager);
  }

  public get player(): Player {
    return this.levelManager.currentPlayer;
  }

  public init(player: Player): void {
    this.levelManager.setPlayer(player);
  }

  public update(): void {
    this.levelManager.update();
  }
}
