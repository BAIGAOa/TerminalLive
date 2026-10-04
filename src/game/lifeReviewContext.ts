import { container } from "../Container.js";
import LevelManager from "../level/LevelManager.js";
import WorldState from "../world/chronicle/WorldState.js";
import HealthSystem from "../world/health/HealthSystem.js";
import EconomySystem from "../world/economy/EconomySystem.js";
import RegionsSystem from "../world/regions/RegionsSystem.js";
import PoliticsSystem from "../world/politics/PoliticsSystem.js";
import NarrativeSystem from "../world/narrative/NarrativeSystem.js";
import AchievementManager from "../achievement/AchievementManager.js";
import LineageStore from "../core/store/LineageStore.js";
import { computeLifeScore } from "./score.js";
import { buildLifeReview, LifeReview } from "./lifeReview.js";

/** Assemble a life review from every live system. Impure (reads the container). */
export function buildLifeReviewFromContainer(
  reason?: "death" | "complete",
): LifeReview {
  const levelManager = container.resolve(LevelManager);
  const player = levelManager.getPlayer();
  const world = container.resolve(WorldState);
  const achievements = container
    .resolve(AchievementManager)
    .getSnapshot()
    .filter((a) => a.unlocked).length;

  let maxRelationship = 0;
  let relationshipsCount = 0;
  for (const v of player.relationships.values()) {
    relationshipsCount += 1;
    if (v > maxRelationship) maxRelationship = v;
  }

  const health = container.resolve(HealthSystem);
  const region = container.resolve(RegionsSystem).getRegion(world.regionId);
  const arcs = container
    .resolve(NarrativeSystem)
    .getArcs()
    .map((a) => ({ id: a.def.id, stage: a.state.stage, total: a.def.stages.length }));

  const { score, rankKey } = computeLifeScore(player, achievements);

  return buildLifeReview({
    name: player.playerName,
    age: Math.floor(player.age),
    reason: reason ?? (player.health > 0 ? "complete" : "death"),
    stats: {
      intelligence: player.intelligence,
      social: player.social,
      fitness: player.fitness,
      happiness: player.happiness,
      health: player.health,
      reputation: player.reputation,
      money: player.money,
    },
    karma: { ...world.karma },
    careerRank: player.careerRank,
    hasCareer: player.careerId !== null,
    maxRelationship,
    relationshipsCount,
    wellbeing: health.wellbeing(),
    lifeExpectancy: health.lifeExpectancy(player),
    netWorth: container.resolve(EconomySystem).netWorth(player.money),
    regionProsperity: region?.prosperity ?? 50,
    publicOrder: container.resolve(PoliticsSystem).publicOrder(),
    arcs,
    achievements,
    generation: container.resolve(LineageStore).getNextGeneration(),
    score,
    rankKey,
  });
}
