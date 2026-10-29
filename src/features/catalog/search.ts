import {
  collectionOptions,
  networks,
  scenarios,
  sorts,
  tabs,
  type CatalogSearch,
} from "./contracts";
import { ethToWei, isEth } from "../../lib/eth";
export const defaultSearch: CatalogSearch = {
  q: "",
  collections: [],
  networks: [],
  minPrice: "",
  maxPrice: "",
  sort: "recent",
  tab: "all",
  page: 1,
  scenario: "default",
};
function choice<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && options.includes(value as T)
    ? (value as T)
    : fallback;
}
function choices<T extends string>(value: unknown, options: readonly T[]): T[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  return options.filter((option) => values.includes(option));
}
export function parseCatalogSearch(
  input: Record<string, unknown>,
): CatalogSearch {
  let minPrice = isEth(input.minPrice) ? input.minPrice : "";
  let maxPrice = isEth(input.maxPrice) ? input.maxPrice : "";
  if (minPrice && maxPrice && ethToWei(minPrice) > ethToWei(maxPrice)) {
    minPrice = "";
    maxPrice = "";
  }
  return {
    q: typeof input.q === "string" ? input.q.trim().slice(0, 100) : "",
    collections: choices(
      input.collections,
      collectionOptions.map(([id]) => id),
    ),
    networks: choices(input.networks, networks),
    minPrice,
    maxPrice,
    sort: choice(input.sort, sorts, "recent"),
    tab: choice(input.tab, tabs, "all"),
    page:
      Number.isSafeInteger(Number(input.page)) && Number(input.page) > 0
        ? Math.min(Number(input.page), 10000)
        : 1,
    scenario: choice(input.scenario, scenarios, "default"),
  };
}
