import { inject } from "../../Container.js";
import Player from "../Player.js";
import RandomService from "../../core/random/RandomService.js";
import TypedEventBus from "../../core/TypedEventBus.js";
import {
  buyProperty,
  buyStock,
  emptyMarket,
  emptyPortfolio,
  EconomyEvent,
  MarketState,
  netWorth as netWorthOf,
  Portfolio,
  repayLoan,
  sellStock,
  STOCKS,
  takeLoan,
  tickFinances,
  tickMarket,
} from "./economyEngine.js";

/**
 * The player's economic life: a drifting market, a portfolio of stocks and
 * property, loans and mortgages, and yearly dividends/interest/rent. The rules
 * live in the pure `economyEngine`; this singleton holds per-life state and
 * bridges to the player's cash and the save file.
 */
export default class EconomySystem {
  private random: RandomService;
  private eventBus: TypedEventBus;
  private market: MarketState = emptyMarket();
  private portfolio: Portfolio = emptyPortfolio();

  constructor() {
    this.random = inject(RandomService);
    this.eventBus = inject(TypedEventBus);
  }

  public reset(): void {
    this.market = emptyMarket();
    this.portfolio = emptyPortfolio();
  }

  public getMarket(): MarketState {
    return this.market;
  }

  public getPortfolio(): Portfolio {
    return this.portfolio;
  }

  public netWorth(cash: number): number {
    return netWorthOf(cash, this.portfolio, this.market);
  }

  private rng = () => this.random.next();

  private emit(events: EconomyEvent[], only?: Set<string>): void {
    for (const ev of events) {
      if (only && !only.has(ev.kind)) continue;
      this.eventBus.emit("toast", { textKey: `economy.ev.${ev.kind}`, kind: "info" });
    }
  }

  public buyStock(player: Player, id: string, shares: number): EconomyEvent[] {
    const price = this.market.stocks[id];
    if (!price) return [{ kind: "market.noStock" }];
    const cost = Math.round(price * shares);
    if (shares <= 0) return [];
    if (player.money < cost) return [{ kind: "market.cantAfford" }];
    player.applyDelta({ money: -cost });
    const { events } = buyStock(this.portfolio, this.market, id, shares);
    player.notify();
    return events;
  }

  public sellStock(player: Player, id: string, shares: number): EconomyEvent[] {
    const { proceeds, events } = sellStock(this.portfolio, this.market, id, shares);
    if (proceeds > 0) {
      player.applyDelta({ money: proceeds });
      player.notify();
    }
    return events;
  }

  public borrow(player: Player, amount: number, rate = 0.06): EconomyEvent[] {
    if (amount <= 0) return [];
    takeLoan(this.portfolio, amount, rate);
    player.applyDelta({ money: amount });
    player.notify();
    return [{ kind: "fin.borrowed", params: { amount } }];
  }

  public repay(player: Player, loanId: string, amount: number): EconomyEvent[] {
    const paid = repayLoan(this.portfolio, loanId, Math.min(amount, player.money));
    if (paid > 0) {
      player.applyDelta({ money: -paid });
      player.notify();
    }
    return paid > 0 ? [{ kind: "fin.repaid", params: { amount: paid } }] : [];
  }

  public buyHome(
    player: Player,
    id: string,
    baseValue: number,
    downPayment: number,
  ): EconomyEvent[] {
    if (player.money < downPayment) return [{ kind: "market.cantAfford" }];
    const { cost, events } = buyProperty(
      this.portfolio,
      this.market,
      id,
      baseValue,
      downPayment,
    );
    // Debit the ENGINE's clamped cost, not the raw input (which may exceed value).
    player.applyDelta({ money: -cost });
    player.notify();
    return events;
  }

  /** Yearly tick: drift the market, then settle dividends/interest/rent.
   *  `bias` (-1..1) tilts the market from the political climate. */
  public tickYear(player: Player, bias = 0): void {
    const marketEvents = tickMarket(this.market, this.rng, bias);
    this.emit(marketEvents, new Set(["market.crash", "market.boom", "market.inflation"]));

    const { cashDelta, events } = tickFinances(this.portfolio, this.market);
    if (cashDelta !== 0) player.applyDelta({ money: cashDelta });
    this.emit(events, new Set(["fin.deficit"]));
    player.notify();
  }

  public snapshot(): { market: MarketState; portfolio: Portfolio } {
    return JSON.parse(JSON.stringify({ market: this.market, portfolio: this.portfolio }));
  }

  public restore(
    snap: { market?: MarketState; portfolio?: Portfolio } | undefined,
  ): void {
    if (!snap) return;
    if (snap.market) this.market = JSON.parse(JSON.stringify(snap.market));
    // Old saves may predate the stock table — backfill so trading still works.
    for (const def of STOCKS) {
      if (typeof this.market.stocks[def.id] !== "number") {
        this.market.stocks[def.id] = 100;
      }
    }
    if (snap.portfolio) this.portfolio = JSON.parse(JSON.stringify(snap.portfolio));
  }
}
