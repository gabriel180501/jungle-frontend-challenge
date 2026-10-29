import { delay, http, HttpResponse } from "msw";
import { getNftDetail } from "./fixtures/nft-details";
import { parseDetailSearch } from "../features/nft-detail/search";
import type { ApiError } from "../features/catalog/contracts";
const failures = new Set<string>();
export function resetDetailScenarios() {
  failures.clear();
}
export const detailHandlers = [
  http.get("/api/nfts/:id", async ({ params, request }) => {
    const scenario = parseDetailSearch(
      Object.fromEntries(new URL(request.url).searchParams),
    ).detailScenario;
    await delay(scenario === "slow" ? 1800 : 220);
    if (scenario === "offline") return HttpResponse.error();
    if (scenario === "error-once" && !failures.has(request.url)) {
      failures.add(request.url);
      return HttpResponse.json<ApiError>(
        {
          code: "TRANSIENT_FAILURE",
          message: "Não foi possível carregar este NFT agora.",
        },
        { status: 503 },
      );
    }
    const detail =
      typeof params.id === "string" ? getNftDetail(params.id) : undefined;
    return detail
      ? HttpResponse.json(detail)
      : HttpResponse.json<ApiError>(
          { code: "NOT_FOUND", message: "NFT não encontrado." },
          { status: 404 },
        );
  }),
];
