import { delay, http, HttpResponse } from "msw";
import { nftFixtures as baseFixtures } from "./fixtures/nfts";
import { getNftDetail } from "./fixtures/nft-details";
import { parseCatalogSearch } from "../features/catalog/search";
import { ethToWei } from "../lib/eth";
import type { ApiError, CatalogResponse } from "../features/catalog/contracts";
const failedRequests = new Set<string>();
export function resetCatalogScenarios() {
  failedRequests.clear();
}
export const catalogHandlers = [
  http.get("/api/nfts", async ({ request }) => {
    const url = new URL(request.url);
    const search = parseCatalogSearch({
      ...Object.fromEntries(url.searchParams),
      collections: url.searchParams.getAll("collection"),
      networks: url.searchParams.getAll("network"),
    });
    const duration =
      search.scenario === "slow"
        ? 1800
        : search.scenario === "out-of-order"
          ? search.q.toLowerCase().includes("sage")
            ? 1500
            : 120
          : 250;
    await delay(duration);
    if (search.scenario === "offline") return HttpResponse.error();
    if (search.scenario === "error-once" && !failedRequests.has(request.url)) {
      failedRequests.add(request.url);
      return HttpResponse.json<ApiError>(
        {
          code: "TRANSIENT_FAILURE",
          message:
            "O catálogo está temporariamente indisponível. Tente novamente.",
        },
        { status: 503 },
      );
    }
    const nftFixtures = baseFixtures.map((nft) => {
      const live = getNftDetail(nft.id)!;
      return {
        ...nft,
        price: live.price,
        available: live.available,
        version: live.version,
      };
    });
    const facets = {
      collections: {} as Record<string, number>,
      networks: {} as Record<string, number>,
    };
    for (const nft of nftFixtures) {
      facets.collections[nft.collection] =
        (facets.collections[nft.collection] || 0) + 1;
      facets.networks[nft.network] = (facets.networks[nft.network] || 0) + 1;
    }
    const q = search.q.toLocaleLowerCase("pt-BR");
    let items =
      search.scenario === "empty"
        ? []
        : nftFixtures.filter(
            (nft) =>
              nft.name.toLocaleLowerCase("pt-BR").includes(q) &&
              (!search.collections.length ||
                search.collections.includes(nft.collection)) &&
              (!search.networks.length ||
                search.networks.includes(nft.network)) &&
              (!search.minPrice ||
                ethToWei(nft.price) >= ethToWei(search.minPrice)) &&
              (!search.maxPrice ||
                ethToWei(nft.price) <= ethToWei(search.maxPrice)) &&
              (search.tab !== "new" || nft.isNew) &&
              (search.tab !== "trending" || nft.trending),
          );
    items = [...items].sort((a, b) => {
      if (search.sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (search.sort === "recent")
        return b.createdAt.localeCompare(a.createdAt);
      const difference = ethToWei(a.price) - ethToWei(b.price);
      return (
        (difference < 0n ? -1 : difference > 0n ? 1 : 0) *
        (search.sort === "price-desc" ? -1 : 1)
      );
    });
    const total = items.length;
    return HttpResponse.json<CatalogResponse>({
      items: items.slice((search.page - 1) * 9, search.page * 9),
      page: search.page,
      pageSize: 9,
      total,
      totalPages: Math.ceil(total / 9),
      facets,
    });
  }),
];
