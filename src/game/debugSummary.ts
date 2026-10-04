/**
 * Pure formatter for the `debug` console command: a compact, human-readable
 * dump of the live simulation state. Plain text (a developer tool, not prose).
 */

export interface DebugSnapshot {
  player: string;
  age: number;
  year: number;
  era: string;
  region: string;
  generation: number;
  cash: number;
  netWorth: number;
  wellbeing: number;
  expectancy: number;
  tension: number;
  order: number;
  marketBias: number;
  factions: number;
  arcs: number;
  chains: string[];
}

export function formatDebugSummary(s: DebugSnapshot): string[] {
  const money = (n: number) => `$${Math.round(n)}`;
  return [
    `player     ${s.player}  age=${s.age}  gen=${s.generation}`,
    `world      year=${s.year}  era=${s.era}  region=${s.region}`,
    `money      cash=${money(s.cash)}  net worth=${money(s.netWorth)}`,
    `health     wellbeing=${s.wellbeing}  expectancy=${s.expectancy}`,
    `politics   tension=${Math.round(s.tension)}  order=${s.order}  factions=${s.factions}  bias=${(s.marketBias * 100).toFixed(1)}%`,
    `narrative  arcs=${s.arcs}  active chains=${s.chains.length ? s.chains.join(", ") : "-"}`,
  ];
}
