import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import { CanceledError } from "axios";
import { api } from "../../lib/api";
import { queryClient } from "../../app/query-client";
import { authEvents, getAuthGeneration } from "../auth/service";
import { useAuth } from "../auth/context";
import type { Nft } from "../catalog/contracts";
import type { FavoritesResponse } from "./contracts";
import { currentIdentity, favoritesKey, favoritesOptions } from "./api";
interface Pending {
  nft: Nft;
  favorite: boolean;
}
const pending = new Map<string, Map<string, Pending>>();
authEvents.addEventListener("change", () => pending.clear());
function operations(userId: string) {
  let value = pending.get(userId);
  if (!value) {
    value = new Map();
    pending.set(userId, value);
  }
  return value;
}
function membership(
  data: FavoritesResponse,
  nft: Nft,
  favorite: boolean,
): FavoritesResponse {
  const items = favorite
    ? data.items.some((item) => item.id === nft.id)
      ? data.items
      : [...data.items, nft]
    : data.items.filter((item) => item.id !== nft.id);
  return { ...data, items, ids: items.map((item) => item.id) };
}
function overlay(data: FavoritesResponse) {
  let result = data;
  for (const operation of operations(data.userId).values())
    result = membership(result, operation.nft, operation.favorite);
  return result;
}
export function useFavorite(nft: Nft) {
  const userId = useAuth().user?.id;
  const query = useQuery(favoritesOptions(userId));
  const count = useIsMutating({
    mutationKey: ["private", userId, "favorite", nft.id],
  });
  const mutation = useMutation({
    mutationKey: ["private", userId, "favorite", nft.id],
    retry: false,
    mutationFn: async ({ favorite }: { favorite: boolean }) =>
      (
        await (favorite
          ? api.put<FavoritesResponse>(
              `/favorites/${encodeURIComponent(nft.id)}`,
            )
          : api.delete<FavoritesResponse>(
              `/favorites/${encodeURIComponent(nft.id)}`,
            ))
      ).data,
    onMutate: async ({ favorite }) => {
      const generation = getAuthGeneration();
      if (!userId || !currentIdentity(userId, generation))
        throw new CanceledError("Sessão indisponível");
      const key = favoritesKey(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FavoritesResponse>(key);
      if (!previous || operations(userId).has(nft.id))
        throw new CanceledError("Operação já em andamento");
      operations(userId).set(nft.id, { nft, favorite });
      queryClient.setQueryData(key, overlay(previous));
      return {
        userId,
        generation,
        previousMember: previous.ids.includes(nft.id),
        nft,
        key,
      };
    },
    onSuccess: (response, _variables, context) => {
      if (!context || !currentIdentity(context.userId, context.generation))
        return;
      operations(context.userId).delete(context.nft.id);
      const current = queryClient.getQueryData<FavoritesResponse>(context.key);
      const base =
        current && current.version > response.version ? current : response;
      queryClient.setQueryData(context.key, overlay(base));
    },
    onError: (_error, _variables, context) => {
      if (!context || !currentIdentity(context.userId, context.generation))
        return;
      operations(context.userId).delete(context.nft.id);
      const current = queryClient.getQueryData<FavoritesResponse>(context.key);
      if (current)
        queryClient.setQueryData(
          context.key,
          overlay(membership(current, context.nft, context.previousMember)),
        );
    },
    onSettled: (_data, _error, _variables, context) => {
      if (
        context &&
        currentIdentity(context.userId, context.generation) &&
        operations(context.userId).size === 0
      )
        return queryClient.invalidateQueries({ queryKey: context.key });
    },
  });
  return {
    query,
    mutation,
    pending: count > 0,
    favorite: query.data?.ids.includes(nft.id) ?? false,
  };
}
