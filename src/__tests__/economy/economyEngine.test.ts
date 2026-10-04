import { describe, it, expect } from "vitest";
import {
  buyProperty,
  buyStock,
  debtTotal,
  emptyMarket,
  emptyPortfolio,
  holdingsValue,
  netWorth,
  repayLoan,
  sellStock,
  takeLoan,
  tickFinances,
  tickMarket,
} from "../../world/economy/economyEngine.js";

const fixed = (v: number) => () => v;

describe("market", () => {
  it("seeds every stock and drifts positive under a good roll", () => {
    const m = emptyMarket();
    tickMarket(m, fixed(0.5));
    expect(m.year).toBe(1);
    expect(m.stocks.stock_index).toBeGreaterThan(100);
    expect(Object.values(m.stocks).every((p) => p > 0)).toBe(true);
  });

  it("keeps inflation inside its band over many years", () => {
    const m = emptyMarket();
    for (let i = 0; i < 200; i++) tickMarket(m, fixed(i % 2 === 0 ? 0 : 0.999));
    expect(m.inflation).toBeGreaterThanOrEqual(-0.02);
    expect(m.inflation).toBeLessThanOrEqual(0.15);
    expect(m.priceIndex).toBeGreaterThan(0);
  });

  it("a positive world bias lifts returns", () => {
    const up = emptyMarket();
    const down = emptyMarket();
    tickMarket(up, fixed(0.5), 1);
    tickMarket(down, fixed(0.5), -1);
    expect(up.stocks.stock_tech).toBeGreaterThan(down.stocks.stock_tech);
  });
});

describe("trading", () => {
  it("tracks average cost across buys", () => {
    const m = emptyMarket();
    const p = emptyPortfolio();
    buyStock(p, m, "stock_index", 10);
    expect(p.holdings.stock_index.avgCost).toBe(100);
    m.stocks.stock_index = 200;
    buyStock(p, m, "stock_index", 10);
    expect(p.holdings.stock_index.shares).toBe(20);
    expect(p.holdings.stock_index.avgCost).toBe(150);
  });

  it("reports profit on sale and clears empty holdings", () => {
    const m = emptyMarket();
    const p = emptyPortfolio();
    buyStock(p, m, "stock_index", 10);
    m.stocks.stock_index = 150;
    const { proceeds, events } = sellStock(p, m, "stock_index", 5);
    expect(proceeds).toBe(750);
    expect(events[0].params?.profit).toBe(250);
    sellStock(p, m, "stock_index", 5);
    expect(p.holdings.stock_index).toBeUndefined();
  });

  it("computes net worth as cash + holdings − debt", () => {
    const m = emptyMarket();
    const p = emptyPortfolio();
    buyStock(p, m, "stock_index", 10);
    m.stocks.stock_index = 150;
    takeLoan(p, 200, 0.06);
    expect(holdingsValue(p, m)).toBe(1500);
    expect(debtTotal(p)).toBe(200);
    expect(netWorth(1000, p, m)).toBe(2300);
  });
});

describe("debt and property", () => {
  it("repays a loan down to zero and drops it", () => {
    const p = emptyPortfolio();
    takeLoan(p, 500, 0.05);
    expect(repayLoan(p, "loan_1", 200)).toBe(200);
    expect(p.loans[0].principal).toBe(300);
    expect(repayLoan(p, "loan_1", 1000)).toBe(300);
    expect(p.loans).toHaveLength(0);
  });

  it("gives each new loan a unique id even after a repayment", () => {
    const p = emptyPortfolio();
    takeLoan(p, 100, 0.05); // loan_1
    takeLoan(p, 100, 0.05); // loan_2
    repayLoan(p, "loan_1", 100); // drops loan_1
    const c = takeLoan(p, 100, 0.05); // must NOT reuse loan_2
    expect(c.id).toBe("loan_3");
    expect(repayLoan(p, c.id, 100)).toBe(100);
  });

  it("buys a home at the market index with a mortgage", () => {
    const m = emptyMarket();
    m.houseIndex = 2;
    const p = emptyPortfolio();
    buyProperty(p, m, "home_1", 100, 50);
    const home = p.properties[0];
    expect(home.value).toBe(200);
    expect(home.mortgage?.principal).toBe(150);
    expect(home.rent).toBe(8);
  });
});

describe("yearly finances", () => {
  it("pays dividends and charges interest", () => {
    const m = emptyMarket();
    const p = emptyPortfolio();
    buyStock(p, m, "stock_index", 10); // 1000 of holdings
    takeLoan(p, 100, 0.5); // 50 interest
    const { cashDelta, events } = tickFinances(p, m);
    // dividends 2% of 1000 = 20, interest 50 → net -30
    expect(cashDelta).toBe(-30);
    expect(events.some((e) => e.kind === "fin.dividends")).toBe(true);
    expect(events.some((e) => e.kind === "fin.deficit")).toBe(true);
  });

  it("pays down a mortgage and collects rent", () => {
    const m = emptyMarket();
    m.houseIndex = 1;
    const p = emptyPortfolio();
    buyProperty(p, m, "home", 1000, 200); // value 1000, mortgage 800, rent 40
    const before = p.properties[0].mortgage!.principal;
    tickFinances(p, m);
    expect(p.properties[0].mortgage!.principal).toBeLessThan(before);
  });
});
