import Player from "../world/Player.js";

export interface LifeScore {
  score: number;
  rankKey: string;
}

/**
 * A rough "how good was this life" number from final stats, wealth, longevity
 * and achievements, plus a rank band for the ending screen.
 */
export function computeLifeScore(
  player: Player,
  unlockedAchievements: number,
): LifeScore {
  const base =
    player.intelligence +
    player.social +
    player.fitness +
    player.happiness +
    Math.round(player.money / 10) +
    Math.round(player.age / 2) +
    unlockedAchievements * 20;
  const score = Math.max(0, Math.round(base));

  let rankKey: string;
  if (score >= 400) rankKey = "rank.s";
  else if (score >= 300) rankKey = "rank.a";
  else if (score >= 200) rankKey = "rank.b";
  else if (score >= 120) rankKey = "rank.c";
  else rankKey = "rank.d";

  return { score, rankKey };
}
