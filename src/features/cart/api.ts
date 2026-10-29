import {
  queryOptions,
  useIsMutating,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import { CanceledError, isAxiosError } from "axios";
import { api } from "../../lib/api";
import { queryClient } from "../../app/query-client";
import { useAuth } from "../auth/context";
import { getAuthGeneration, sessionKey } from "../auth/service";
import type { Session } from "../auth/contracts";
import type { Cart, CartInput, Quote } from "./contracts";
const ownerKey = (userId?: string) => (userId ? `user:${userId}` : "guest");
export const cartKey = (userId?: string) => ["cart", ownerKey(userId)] as const;
function matches(
  data: { owner: string },
  userId: string | undefined,
  generation: number,
) {
  const currentId = queryClient.getQueryData<Session>(sessionKey)?.user?.id;
  return (
    generation === getAuthGeneration() &&
    currentId === userId &&
    (userId ? data.owner === `user:${userId}` : data.owner.startsWith("guest:"))
  );
}
export function cartOptions(userId?: string) {
  return queryOptions({
    queryKey: cartKey(userId),
    retry: false,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const generation = getAuthGeneration();
      const data = (await api.get<Cart>("/cart", { signal })).data;
      if (!matches(data, userId, generation))
        throw new CanceledError("Identidade alterada");
      return data;
    },
  });
}
export function useCart(poll = false) {
  const auth = useAuth();
  return useQuery({
    ...cartOptions(auth.user?.id),
    enabled: !auth.loading && !auth.error,
    refetchInterval: poll ? 30000 : false,
    refetchOnWindowFocus: true,
  });
}
export function useQuote(cart?: Cart) {
  const auth = useAuth(),
    userId = auth.user?.id;
  return useQuery({
    queryKey: [
      ...cartKey(userId),
      "quote",
      cart?.version ?? -1,
      cart?.items
        .map((i) => [i.id, i.unitPrice, i.available, i.limit, i.quantity])
        .flat()
        .join("|"),
    ],
    enabled: !!cart?.items.length && !auth.loading && !auth.error,
    retry: false,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async ({ signal }) => {
      const generation = getAuthGeneration();
      const data = (await api.post<Quote>("/cart/quote", {}, { signal })).data;
      if (!matches(data, userId, generation))
        throw new CanceledError("Identidade alterada");
      return data;
    },
  });
}
export type CartAction =
  | { kind: "add" | "quantity" | "remove"; item: CartInput }
  | { kind: "coupon"; coupon: string };
export function useCartMutation() {
  const userId = useAuth().user?.id;
  const key = cartKey(userId);
  return useMutation({
    mutationKey: ["cart-write", ownerKey(userId)],
    scope: { id: `cart-write:${ownerKey(userId)}` },
    retry: false,
    mutationFn: async (action: CartAction) => {
      const generation = getAuthGeneration();
      // A busca atual também protege contra abas com uma versão antiga.
      const cart = await queryClient.fetchQuery(cartOptions(userId));
      if (!matches(cart, userId, generation))
        throw new CanceledError("Identidade alterada");
      const config = {
        data:
          action.kind === "coupon"
            ? { coupon: action.coupon, version: cart.version }
            : { ...action.item, version: cart.version },
      };
      const result =
        action.kind === "coupon"
          ? await api.put<Cart>("/cart/coupon", config.data)
          : action.kind === "remove"
            ? await api.delete<Cart>("/cart/items", config)
            : action.kind === "add"
              ? await api.post<Cart>("/cart/items", config.data)
              : await api.put<Cart>("/cart/items", config.data);
      if (!matches(result.data, userId, generation))
        throw new CanceledError("Identidade alterada");
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(key, data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ["nfts"] });
      void queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey[0] === "private" &&
          (q.queryKey[2] === "checkout-quote" || q.queryKey[2] === "orders"),
      });
    },
  });
}
export function useCartBusy() {
  const userId = useAuth().user?.id;
  return useIsMutating({ mutationKey: ["cart-write", ownerKey(userId)] }) > 0;
}
export function cartError(error: unknown) {
  return isAxiosError(error)
    ? (error.response?.data?.message ??
        "Falha de conexão. Confira sua rede e tente novamente.")
    : "Não foi possível alterar o carrinho. Tente novamente.";
}
const channel = new BroadcastChannel("kurio-commerce");
channel.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.kind !== "cart") return;
  const userId = queryClient.getQueryData<Session>(sessionKey)?.user?.id;
  if (
    message.owner &&
    (userId
      ? message.owner !== `user:${userId}`
      : !message.owner.startsWith("guest:"))
  )
    return;
  void queryClient.invalidateQueries({ queryKey: cartKey(userId) });
  if (userId)
    void queryClient.invalidateQueries({
      queryKey: ["private", userId, "checkout-quote"],
    });
});
