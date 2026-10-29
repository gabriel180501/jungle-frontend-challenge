import { queryClient } from "../../app/query-client";
import { queryOptions } from "@tanstack/react-query";
import { CanceledError, isAxiosError } from "axios";
import { api } from "../../lib/api";
import { currentIdentity } from "../account/api";
import { getAuthGeneration } from "../auth/service";
import type { Network } from "../catalog/contracts";
import type {
  Attempt,
  CheckoutQuote,
  Connection,
  Order,
  Review,
  ReviewInput,
} from "./contracts";
export const ordersKey = (userId?: string) =>
  ["private", userId, "orders"] as const;
async function owned<T extends { userId: string }>(
  userId: string,
  request: () => Promise<T>,
) {
  const generation = getAuthGeneration();
  if (!currentIdentity(userId, generation))
    throw new CanceledError("Sessão alterada");
  const data = await request();
  if (data.userId !== userId || !currentIdentity(userId, generation))
    throw new CanceledError("Resposta de outra sessão descartada");
  const order = data as unknown as Order;
  if (
    typeof order.id === "string" &&
    Number.isSafeInteger(order.version) &&
    ["pending", "confirmed", "rejected"].includes(order.status)
  ) {
    const cached = queryClient.getQueryData<Order>([
      ...ordersKey(userId),
      order.id,
    ]);
    if (
      cached &&
      (cached.version > order.version ||
        (cached.status !== "pending" && order.status === "pending"))
    )
      return cached as unknown as T;
  }
  return data;
}
export const connectWallet = (
  userId: string,
  walletId: string,
  network: Network,
) =>
  owned(
    userId,
    async () =>
      (await api.post<Connection>("/wallet-connections", { walletId, network }))
        .data,
  );
export async function disconnectWallet(userId: string, id: string) {
  const generation = getAuthGeneration();
  await api.delete(`/wallet-connections/${encodeURIComponent(id)}`);
  if (!currentIdentity(userId, generation))
    throw new CanceledError("Sessão alterada");
}
export const reviewPurchase = (userId: string, input: ReviewInput) =>
  owned(
    userId,
    async () => (await api.post<Review>("/checkout/review", input)).data,
  );
export const sendOrder = (userId: string, attempt: Attempt) =>
  owned(
    userId,
    async () =>
      (
        await api.post<Order>(
          "/orders",
          { reviewId: attempt.reviewId },
          { headers: { "Idempotency-Key": attempt.key }, timeout: 2000 },
        )
      ).data,
  );
export function connectionOptions(userId: string, id?: string) {
  return queryOptions({
    queryKey: ["private", userId, "connection", id],
    enabled: !!id,
    retry: false,
    refetchInterval: 1000,
    queryFn: ({ signal }) =>
      owned(
        userId,
        async () =>
          (
            await api.get<Connection>(
              `/wallet-connections/${encodeURIComponent(id!)}`,
              { signal },
            )
          ).data,
      ),
  });
}
export function checkoutQuoteOptions(userId: string, network: Network) {
  return queryOptions({
    queryKey: ["private", userId, "checkout-quote", network],
    retry: false,
    refetchInterval: 30000,
    queryFn: ({ signal }) =>
      owned(
        userId,
        async () =>
          (
            await api.post<CheckoutQuote>(
              "/checkout/quote",
              { network },
              { signal },
            )
          ).data,
      ),
  });
}
export function orderOptions(userId: string, id: string) {
  return queryOptions<Order>({
    queryKey: [...ordersKey(userId), id],
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 30000 : false,
    refetchOnReconnect: true,
    queryFn: ({ signal }) =>
      owned(
        userId,
        async () =>
          (
            await api.get<Order>(`/orders/${encodeURIComponent(id)}`, {
              signal,
            })
          ).data,
      ),
  });
}
export function listOrdersOptions(userId: string) {
  return queryOptions({
    queryKey: [...ordersKey(userId), "list"],
    retry: false,
    refetchInterval: 30000,
    queryFn: ({ signal }) =>
      owned(
        userId,
        async () =>
          (
            await api.get<{ userId: string; items: Order[] }>("/orders", {
              signal,
            })
          ).data,
      ),
  });
}
export async function findAttempt(
  userId: string,
  key: string,
): Promise<Order | null> {
  try {
    return await owned(
      userId,
      async () =>
        (await api.get<Order>(`/orders/by-key/${encodeURIComponent(key)}`))
          .data,
    );
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}
const attemptKey = (userId: string) => `kurio.attempt.${userId}`;
export function loadAttempt(userId: string): Attempt | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(attemptKey(userId)) ?? "null",
    );
    return value &&
      typeof value.key === "string" &&
      typeof value.reviewId === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveAttempt(userId: string, attempt: Attempt | null) {
  if (attempt)
    sessionStorage.setItem(attemptKey(userId), JSON.stringify(attempt));
  else sessionStorage.removeItem(attemptKey(userId));
}
export function checkoutError(error: unknown) {
  return isAxiosError(error)
    ? (error.response?.data?.message ??
        "Não foi possível obter uma resposta. Recupere a tentativa antes de enviar outra compra.")
    : "Não foi possível concluir a operação. Tente novamente.";
}
export function definitive(error: unknown) {
  return (
    isAxiosError(error) &&
    !!error.response &&
    [400, 403, 404, 409, 422].includes(error.response.status)
  );
}
