/**
 * Pure economy simulation: a drifting market (inflation, goods/housing price
 * indices, stock prices), a portfolio of holdings, debts and property. No
 * container, no React — the `EconomySystem` singleton is a thin shell over it.
 */

export interface StockDef {
  id: string;
  /** Tick/company volatility. */
  vol: number;
  /** Long-run yearly drift. */
  drift: number;
}

export const STOCKS: StockDef[] = [
  { id: "stock_index", vol: 0.14, drift: 0.05 },
  { id: "stock_tech", vol: 0.32, drift: 0.08 },
  { id: "stock_energy", vol: 0.22, drift: 0.03 },
  { id: "stock_gold", vol: 0.1, drift: 0.02 },
];

export interface MarketState {
  year: number;
  /** Annual inflation rate (e.g. 0.03). */
  inflation: number;
  /** Goods price level, base 1. */
  priceIndex: number;
  /** Housing price level, base 1. */
  houseIndex: number;
  /** Stock id → price. */
  stocks: Record<string, number>;
}

export interface Loan {
  id: string;
  principal: number;
  rate: number;
}

export interface Holding {
  shares: number;
  avgCost: number;
}

export interface Property {
  id: string;
  value: number;
  rent: number;
  mortgage?: Loan;
}

export interface Portfolio {
  holdings: Record<string, Holding>;
  loans: Loan[];
  properties: Property[];
}

export interface EconomyEvent {
  kind: string;
  params?: Record<string, number | string>;
}

export type Rng = () => number;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function emptyMarket(): MarketState {
  const stocks: Record<string, number> = {};
  for (const s of STOCKS) stocks[s.id] = 100;
  return { year: 0, inflation: 0.03, priceIndex: 1, houseIndex: 1, stocks };
}

export function emptyPortfolio(): Portfolio {
  return { holdings: {}, loans: [], properties: [] };
}

/** One year of market drift; `bias` (-1..1) tilts a boom/bust from the world. */
export function tickMarket(
  market: MarketState,
  rng: Rng,
  bias = 0,
): EconomyEvent[] {
  const events: EconomyEvent[] = [];
  market.year += 1;
  market.inflation = clamp(
    market.inflation + (rng() - 0.5) * 0.03 + bias * 0.02,
    -0.02,
    0.15,
  );
  const goods = 1 + market.inflation + (rng() - 0.5) * 0.02;
  market.priceIndex = Math.max(0.2, market.priceIndex * goods);
  market.houseIndex = Math.max(
    0.2,
    market.houseIndex * (1 + market.inflation * 0.7 + (rng() - 0.5) * 0.06 + bias * 0.03),
  );

  for (const def of STOCKS) {
    const cur = market.stocks[def.id] ?? 100;
    const ret = def.drift + def.vol * (rng() - 0.5) * 2 + bias * def.vol;
    const next = Math.max(1, cur * (1 + ret));
    market.stocks[def.id] = Math.round(next * 100) / 100;
    if (ret < -0.15) events.push({ kind: "market.crash", params: { id: def.id } });
    else if (ret > 0.2) events.push({ kind: "market.boom", params: { id: def.id } });
  }
  if (market.inflation > 0.08) events.push({ kind: "market.inflation" });
  return events;
}

export function holdingsValue(portfolio: Portfolio, market: MarketState): number {
  let total = 0;
  for (const [id, h] of Object.entries(portfolio.holdings)) {
    total += (market.stocks[id] ?? 0) * h.shares;
  }
  return Math.round(total);
}

export function propertyValue(portfolio: Portfolio): number {
  return portfolio.properties.reduce((s, p) => s + p.value, 0);
}

export function debtTotal(portfolio: Portfolio): number {
  return (
    portfolio.loans.reduce((s, l) => s + l.principal, 0) +
    portfolio.properties.reduce((s, p) => s + (p.mortgage?.principal ?? 0), 0)
  );
}

export function netWorth(cash: number, portfolio: Portfolio, market: MarketState): number {
  return Math.round(
    cash + holdingsValue(portfolio, market) + propertyValue(portfolio) - debtTotal(portfolio),
  );
}

export function buyStock(
  portfolio: Portfolio,
  market: MarketState,
  id: string,
  shares: number,
): { cost: number; events: EconomyEvent[] } {
  const price = market.stocks[id];
  if (!price || shares <= 0) return { cost: 0, events: [{ kind: "market.noStock" }] };
  const cost = Math.round(price * shares);
  const prev = portfolio.holdings[id] ?? { shares: 0, avgCost: price };
  const totalShares = prev.shares + shares;
  portfolio.holdings[id] = {
    shares: totalShares,
    avgCost: Math.round(
      ((prev.avgCost * prev.shares + price * shares) / totalShares) * 100,
    ) / 100,
  };
  return { cost, events: [{ kind: "market.bought", params: { id, shares } }] };
}

export function sellStock(
  portfolio: Portfolio,
  market: MarketState,
  id: string,
  shares: number,
): { proceeds: number; events: EconomyEvent[] } {
  const h = portfolio.holdings[id];
  const price = market.stocks[id];
  if (!h || !price || shares <= 0) return { proceeds: 0, events: [] };
  const sold = Math.min(shares, h.shares);
  const proceeds = Math.round(price * sold);
  h.shares -= sold;
  const profit = Math.round((price - h.avgCost) * sold);
  if (h.shares <= 0) delete portfolio.holdings[id];
  return {
    proceeds,
    events: [{ kind: "market.sold", params: { id, shares: sold, profit } }],
  };
}

export function takeLoan(portfolio: Portfolio, amount: number, rate: number): Loan {
  // Monotonic id: deriving from `loans.length` collides once a loan is repaid,
  // which would make `repayLoan` target the wrong debt.
  const next = portfolio.loans.reduce((max, l) => {
    const n = Number(l.id.replace(/[^0-9]/g, ""));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  const loan: Loan = { id: `loan_${next + 1}`, principal: amount, rate };
  portfolio.loans.push(loan);
  return loan;
}

export function repayLoan(portfolio: Portfolio, id: string, amount: number): number {
  const idx = portfolio.loans.findIndex((l) => l.id === id);
  if (idx < 0) return 0;
  const loan = portfolio.loans[idx];
  const paid = Math.min(amount, loan.principal);
  loan.principal -= paid;
  if (loan.principal <= 0) portfolio.loans.splice(idx, 1);
  return paid;
}

export function buyProperty(
  portfolio: Portfolio,
  market: MarketState,
  id: string,
  baseValue: number,
  downPayment: number,
): { cost: number; events: EconomyEvent[] } {
  const value = Math.round(baseValue * market.houseIndex);
  // Clamp the down payment to the value so a caller can't overpay.
  const paid = Math.max(0, Math.min(downPayment, value));
  const loan = Math.max(0, value - paid);
  const property: Property = { id, value, rent: Math.round(value * 0.04) };
  if (loan > 0) property.mortgage = { id: `mtg_${id}`, principal: loan, rate: 0.05 };
  portfolio.properties.push(property);
  return { cost: paid, events: [{ kind: "market.boughtHome" }] };
}

/**
 * One year of personal finance: dividends on holdings, rent from property,
 * interest on every debt and mortgage. Returns the net cash change (may be
 * negative) and events. Never mutates the portfolio's values except debt.
 */
export function tickFinances(
  portfolio: Portfolio,
  market: MarketState,
): { cashDelta: number; events: EconomyEvent[] } {
  const events: EconomyEvent[] = [];
  let delta = 0;

  const hv = holdingsValue(portfolio, market);
  const dividends = Math.round(hv * 0.02);
  if (dividends > 0) {
    delta += dividends;
    events.push({ kind: "fin.dividends", params: { amount: dividends } });
  }

  for (const l of portfolio.loans) {
    const interest = Math.round(l.principal * l.rate);
    delta -= interest;
    events.push({ kind: "fin.interest", params: { amount: interest } });
  }

  for (const p of portfolio.properties) {
    delta += p.rent;
    if (p.mortgage) {
      const interest = Math.round(p.mortgage.principal * p.mortgage.rate);
      const principalPay = Math.round(p.mortgage.principal * 0.03);
      delta -= interest + principalPay;
      p.mortgage.principal = Math.max(0, p.mortgage.principal - principalPay);
      if (p.mortgage.principal <= 0) p.mortgage = undefined;
    }
  }

  if (delta < 0) events.push({ kind: "fin.deficit", params: { amount: -delta } });
  return { cashDelta: delta, events };
}
