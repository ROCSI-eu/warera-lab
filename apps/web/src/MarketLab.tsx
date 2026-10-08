import type { MarketLabItemResponse, MarketLabOverviewResponse } from "@warera-lab/domain";
import { useCallback, useEffect, useState } from "react";

import { MarketLabShell } from "./MarketLabShell.js";
import { buildLabHref } from "./lab-navigation.js";
import { PublicApiClientError, getMarketItem, getMarketOverview } from "./public-api.js";

function marketError(error: unknown): string {
  if (!(error instanceof PublicApiClientError)) {
    return "Market Lab could not load this current-state context. Please try again.";
  }
  return (
    error.message +
    (error.code === "UPSTREAM_RATE_LIMITED" && error.retryAfterSeconds !== undefined
      ? " Suggested retry: in about " + error.retryAfterSeconds + " seconds."
      : "")
  );
}

export function MarketLab({
  itemCode,
  navigationMessage,
  playerId,
  companyId,
}: {
  itemCode?: string;
  navigationMessage?: string;
  playerId?: string;
  companyId?: string;
}) {
  const [overview, setOverview] = useState<MarketLabOverviewResponse>();
  const [item, setItem] = useState<MarketLabItemResponse>();
  const [overviewError, setOverviewError] = useState<string>();
  const [itemError, setItemError] = useState<string>();
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingItem, setIsLoadingItem] = useState(Boolean(itemCode));
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let current = true;
    // Each mount and explicit refresh performs one demand-driven inspection.
    // Do not poll or replace previously received values with fabricated defaults.
    void getMarketOverview().then(
      (data) => {
        if (current) {
          setOverview(data);
          setOverviewError(undefined);
          setIsLoadingOverview(false);
        }
      },
      (error: unknown) => {
        if (current) {
          setOverviewError(marketError(error));
          setIsLoadingOverview(false);
        }
      },
    );
    if (itemCode) {
      void getMarketItem(itemCode).then(
        (data) => {
          if (current) {
            setItem(data);
            setItemError(undefined);
            setIsLoadingItem(false);
          }
        },
        (error: unknown) => {
          if (current) {
            setItemError(marketError(error));
            setIsLoadingItem(false);
          }
        },
      );
    }
    return () => {
      current = false;
    };
  }, [itemCode, refreshVersion]);

  const refresh = useCallback(() => {
    setIsLoadingOverview(true);
    setIsLoadingItem(Boolean(itemCode));
    setOverview(undefined);
    setItem(undefined);
    setOverviewError(undefined);
    setItemError(undefined);
    setRefreshVersion((current) => current + 1);
  }, [itemCode]);

  const economyLabHref = () => {
    if (typeof window === "undefined") return "/?lab=economy";
    // Never treat a portable scenario fragment as an implicit cross-lab transfer.
    // Economy Lab revalidates any identifiers through its existing public snapshot flow.
    return buildLabHref(
      {
        lab: "economy",
        ...(playerId ? { playerId } : {}),
        ...(playerId && companyId ? { companyId } : {}),
      },
      {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash.startsWith("#wl=") ? "" : window.location.hash,
      },
    );
  };

  const itemHref = (nextItemCode?: string) => {
    if (typeof window === "undefined") return "/?lab=market";
    return buildLabHref(
      {
        lab: "market",
        ...(playerId ? { playerId } : {}),
        ...(playerId && companyId ? { companyId } : {}),
        ...(nextItemCode ? { itemCode: nextItemCode } : {}),
      },
      window.location,
    );
  };

  return (
    <MarketLabShell
      {...(itemCode ? { itemCode } : {})}
      {...(navigationMessage ? { navigationMessage } : {})}
      {...(overview ? { overview } : {})}
      {...(item && item.itemCode === itemCode ? { item } : {})}
      {...(overviewError ? { overviewError } : {})}
      {...(itemError ? { itemError } : {})}
      isLoadingOverview={isLoadingOverview}
      isLoadingItem={isLoadingItem}
      itemHref={itemHref}
      economyLabHref={economyLabHref()}
      handoffIdentity={playerId ? (companyId ? "company" : "player") : "standalone"}
      onRefresh={refresh}
    />
  );
}
