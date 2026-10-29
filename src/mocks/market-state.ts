import { emitBusiness } from "./event-bus";
import type { NftDetail } from "../features/nft-detail/contracts";
const key = "kurio.mock.market.v1";
interface Market {
  revision: number;
  versions?: Record<string, number>;
  reserved?: Record<string, number>;
  networkFee?: string;
  couponExpired?: boolean;
  editions: Record<string, { price?: string; available?: number }>;
}
function load(): Market {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (value?.editions) return value;
  } catch {
    /* Recria cenário inválido. */
  }
  return { revision: 0, editions: {} };
}
export function marketDetail(detail: NftDetail): NftDetail {
  const market = load();
  const editions = detail.editions.map((edition) => ({
    ...edition,
    ...market.editions[`${detail.id}:${edition.id}`],
  }));
  editions.forEach((edition) => {
    edition.available = Math.max(
      0,
      edition.available -
        (market.reserved?.[`${detail.id}:${edition.id}`] ?? 0),
    );
  });
  const main = editions.find((e) => e.id === detail.defaultEditionId)!;
  return {
    ...detail,
    editions,
    price: main.price,
    available: main.available,
    version: market.versions?.[detail.id] ?? 1,
  };
}
export function changeMarket(
  nftId: string,
  editionId: string,
  values: { price?: string; available?: number },
) {
  const market = load();
  market.editions[`${nftId}:${editionId}`] = {
    ...market.editions[`${nftId}:${editionId}`],
    ...values,
  };
  market.revision++;
  market.versions ??= {};
  market.versions[nftId] = (market.versions[nftId] ?? 1) + 1;
  localStorage.setItem(key, JSON.stringify(market));
  emitBusiness("nft.updated", nftId, market.versions[nftId], "public");
  commerceChanged("market");
}
export function commerceChanged(
  kind: "cart" | "market" | "order" | "reset" = "cart",
  owner?: string,
) {
  const channel = new BroadcastChannel("kurio-commerce");
  channel.postMessage({ kind, owner });
  channel.close();
}
export function resetMarket() {
  localStorage.removeItem(key);
  commerceChanged("reset");
}

export function pricing() {
  const market = load();
  return {
    networkFee: market.networkFee ?? "0.016",
    couponExpired: market.couponExpired ?? false,
  };
}
export function changePricing(networkFee: string, couponExpired: boolean) {
  const market = load();
  market.networkFee = networkFee;
  market.couponExpired = couponExpired;
  market.revision++;
  localStorage.setItem(key, JSON.stringify(market));
  emitBusiness("pricing.updated", "pricing", market.revision, "public");
  commerceChanged("market");
}
interface StockLine {
  nftId: string;
  editionId: string;
  quantity: number;
  available: number;
}
export function holdStock(items: StockLine[]) {
  const market = load();
  market.reserved ??= {};
  for (const item of items) {
    const id = `${item.nftId}:${item.editionId}`,
      held = market.reserved[id] ?? 0;
    market.editions[id] ??= {};
    market.editions[id].available ??= item.available + held;
    market.reserved[id] = held + item.quantity;
  }
  bumpStock(market, items);
  localStorage.setItem(key, JSON.stringify(market));
}
export function settleStock(items: StockLine[], confirmed: boolean) {
  const market = load();
  market.reserved ??= {};
  for (const item of items) {
    const id = `${item.nftId}:${item.editionId}`;
    market.reserved[id] = Math.max(
      0,
      (market.reserved[id] ?? 0) - item.quantity,
    );
    if (confirmed && market.editions[id]?.available !== undefined)
      market.editions[id].available = Math.max(
        0,
        market.editions[id].available! - item.quantity,
      );
  }
  bumpStock(market, items);
  localStorage.setItem(key, JSON.stringify(market));
}
function bumpStock(market: Market, items: StockLine[]) {
  market.versions ??= {};
  for (const id of new Set(items.map((i) => i.nftId)))
    market.versions[id] = (market.versions[id] ?? 1) + 1;
  market.revision++;
}
export function notifyStock(items: StockLine[]) {
  const market = load();
  for (const id of new Set(items.map((i) => i.nftId)))
    emitBusiness("nft.updated", id, market.versions?.[id] ?? 1, "public");
}
