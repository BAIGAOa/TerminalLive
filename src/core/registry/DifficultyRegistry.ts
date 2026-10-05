import World from "../../worlds/World.js";

export default class DifficultyRegistry {
  private readonly map = new Map<string, Map<string, World>>();

  public register(difficulty: string, level: World): void {
    if (!this.map.has(difficulty)) {
      this.map.set(difficulty, new Map());
    }
    this.map.get(difficulty)!.set(level.id, level);
  }

  public unregister(levelId: string): void {
    for (const inner of this.map.values()) {
      inner.delete(levelId);
    }
  }

  public getDifficulties(): string[] {
    return Array.from(this.map.keys());
  }

  public getLevels(difficulty: string): World[] {
    const inner = this.map.get(difficulty);
    return inner ? Array.from(inner.values()) : [];
  }
}
