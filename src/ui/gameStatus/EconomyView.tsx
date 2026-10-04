import React, { useSyncExternalStore } from "react";
import { Text } from "ink";
import Player from "../../world/Player.js";
import { container } from "../../Container.js";
import EconomySystem from "../../world/economy/EconomySystem.js";
import { STOCKS } from "../../world/economy/economyEngine.js";
import { StatusScroll } from "./common.js";

/** Market, portfolio, property and debt — the player's economic life. */
export default function EconomyView({
  player,
  t,
  height,
}: {
  player: Player;
  t: (key: string, params?: Record<string, string | number>) => string;
  height?: number;
}) {
  // Cash lives on the player; re-render when it changes.
  useSyncExternalStore(player.subscribe, () => player.money);
  const economy = container.resolve(EconomySystem);
  const market = economy.getMarket();
  const portfolio = economy.getPortfolio();

  const lines: React.ReactNode[] = [
    <Text color="cyan" bold>
      {t("economy.title")}
    </Text>,
    null,
    <Text dimColor>── {t("economy.market")} ──</Text>,
    <Text>
      {t("economy.inflation")}:{" "}
      <Text color={market.inflation > 0.06 ? "red" : "yellow"}>
        {(market.inflation * 100).toFixed(1)}%
      </Text>
      {"   "}
      {t("economy.goods")}: {market.priceIndex.toFixed(2)}
      {"   "}
      {t("economy.housing")}: {market.houseIndex.toFixed(2)}
    </Text>,
  ];

  for (const def of STOCKS) {
    const held = portfolio.holdings[def.id]?.shares ?? 0;
    lines.push(
      <Text key={def.id}>
        {t(`stock.${def.id}`)}:{" "}
        <Text color="yellow">${market.stocks[def.id]?.toFixed(2) ?? "-"}</Text>
        {held > 0 ? (
          <Text dimColor>  x{held}</Text>
        ) : null}
      </Text>,
    );
  }

  lines.push(
    null,
    <Text dimColor>── {t("economy.portfolio")} ──</Text>,
    <Text color="greenBright">
      {t("economy.netWorth")}: ${economy.netWorth(player.money)}
    </Text>,
    <Text>
      {t("economy.cash")}: <Text color="yellow">${player.money}</Text>
    </Text>,
  );

  const holdings = Object.entries(portfolio.holdings);
  if (holdings.length > 0) {
    lines.push(
      <Text dimColor>
        {t("economy.holdings")}:{" "}
        {holdings
          .map(([id, h]) => `${t(`stock.${id}`)}×${h.shares}`)
          .join("  ")}
      </Text>,
    );
  }

  if (portfolio.properties.length > 0) {
    for (const p of portfolio.properties) {
      lines.push(
        <Text key={p.id} color="cyan">
          🏠 {t("economy.home")}: ${p.value} {t("economy.rent")} ${p.rent}
          {p.mortgage ? (
            <Text color="red">
              {" "}
              {t("economy.mortgage")} ${p.mortgage.principal}
            </Text>
          ) : null}
        </Text>,
      );
    }
  }

  if (portfolio.loans.length > 0) {
    for (const l of portfolio.loans) {
      lines.push(
        <Text key={l.id} color="red">
          {t("economy.debt")}: ${l.principal} @ {(l.rate * 100).toFixed(0)}%
        </Text>,
      );
    }
  }

  return <StatusScroll height={height} lines={lines} />;
}
