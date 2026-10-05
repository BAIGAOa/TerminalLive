import World from "../../worlds/World.js";

export default class DifficultyRegistry {
  private readonly map = new Map<string, Map<string, World>>();

  public register(difficulty: string, level: World): void {
    let inner = this.map.get(difficulty);
    if (!inner) {
      inner = new Map();
      this.map.set(difficulty, inner);
    }
    // Match BaseRegistry semantics: a duplicate is a content bug, not a silent
    // overwrite. (Callers guard against duplicate level ids before reaching here.)
    if (inner.has(level.id)) {
      throw new Error(`难度 "${difficulty}" 中关卡 "${level.id}" 已注册`);
    }
    inner.set(level.id, level);
  }

  public unregister(levelId: string): void {
    for (const [difficulty, inner] of this.map) {
      inner.delete(levelId);
      if (inner.size === 0) this.map.delete(difficulty);
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
