import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { DetailScenario, NftDetail } from "./contracts";
export function nftDetailOptions(
  id: string,
  scenario: DetailScenario = "default",
) {
  return queryOptions({
    queryKey: ["nfts", "detail", id, scenario],
    queryFn: async ({ signal }) =>
      (
        await api.get<NftDetail>(`/nfts/${encodeURIComponent(id)}`, {
          signal,
          params: { detailScenario: scenario },
        })
      ).data,
    retry: false,
  });
}
