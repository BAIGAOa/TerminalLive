import { Scope, Scoped } from "di-wise";
import Level from "../Level.js";

@Scoped(Scope.Container)
export default class DifficultyRegistry {
  private readonly map = new Map<string, Map<string, Level>>();

  public register(difficulty: string, level: Level): void {
    if (!this.map.has(difficulty)) {
      this.map.set(difficulty, new Map());
    }
    this.map.get(difficulty)!.set(level.id, level);
  }

  public remove(levelId: string): void {
    for (const inner of this.map.values()) {
      inner.delete(levelId);
    }
  }

  public getDifficulties(): string[] {
    return Array.from(this.map.keys());
  }

  public getLevels(difficulty: string): Level[] {
    const inner = this.map.get(difficulty);
    return inner ? Array.from(inner.values()) : [];
  }
}