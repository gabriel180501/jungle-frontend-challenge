import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { CatalogResponse, CatalogSearch } from "./contracts";
export function catalogOptions(search: CatalogSearch) {
  return queryOptions({
    queryKey: ["nfts", "list", search],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        q: search.q,
        page: String(search.page),
        sort: search.sort,
        tab: search.tab,
        scenario: search.scenario,
      });
      search.collections.forEach((value) => params.append("collection", value));
      search.networks.forEach((value) => params.append("network", value));
      if (search.minPrice) params.set("minPrice", search.minPrice);
      if (search.maxPrice) params.set("maxPrice", search.maxPrice);
      return (await api.get<CatalogResponse>("/nfts", { params, signal })).data;
    },
    retry: false,
  });
}
