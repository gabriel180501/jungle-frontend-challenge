import { queryOptions } from "@tanstack/react-query";
import { CanceledError } from "axios";
import { api } from "../../lib/api";
import { queryClient } from "../../app/query-client";
import { getAuthGeneration, sessionKey } from "../auth/service";
import type { Session } from "../auth/contracts";
import type {
  Profile,
  ProfileInput,
  PasswordInput,
  Wallet,
  WalletInput,
  WalletsResponse,
  FavoritesResponse,
} from "./contracts";
export function currentIdentity(
  userId: string,
  generation = getAuthGeneration(),
) {
  return (
    generation === getAuthGeneration() &&
    queryClient.getQueryData<Session>(sessionKey)?.user?.id === userId
  );
}
function check<T>(data: T, userId: string, generation: number) {
  if (!currentIdentity(userId, generation))
    throw new CanceledError("Resposta de uma sessão anterior descartada");
  return data;
}
export const profileKey = (userId?: string) =>
  ["private", userId, "profile"] as const;
export const walletsKey = (userId?: string) =>
  ["private", userId, "wallets"] as const;
export const favoritesKey = (userId?: string) =>
  ["private", userId, "favorites"] as const;
export function profileOptions(
  userId?: string,
  scenario: "slow" | "default" = "default",
) {
  return queryOptions({
    queryKey: profileKey(userId),
    enabled: !!userId,
    retry: false,
    queryFn: async ({ signal }) => {
      const generation = getAuthGeneration();
      const data = (
        await api.get<Profile>("/profile", {
          signal,
          params: { accountScenario: scenario },
        })
      ).data;
      if (data.id !== userId) throw new CanceledError("Perfil de outra conta");
      return check(data, userId!, generation);
    },
  });
}
export function walletsOptions(userId?: string) {
  return queryOptions({
    queryKey: walletsKey(userId),
    enabled: !!userId,
    retry: false,
    queryFn: async ({ signal }) => {
      const generation = getAuthGeneration();
      const data = (await api.get<WalletsResponse>("/wallets", { signal }))
        .data;
      if (data.userId !== userId)
        throw new CanceledError("Carteiras de outra conta");
      return check(data, userId!, generation);
    },
  });
}
export function favoritesOptions(userId?: string) {
  return queryOptions({
    queryKey: favoritesKey(userId),
    enabled: !!userId,
    retry: false,
    queryFn: async ({ signal }) => {
      const generation = getAuthGeneration();
      const data = (await api.get<FavoritesResponse>("/favorites", { signal }))
        .data;
      if (data.userId !== userId)
        throw new CanceledError("Favoritos de outra conta");
      return check(data, userId!, generation);
    },
  });
}
export async function updateProfile(
  userId: string,
  input: ProfileInput & { version: number },
) {
  const generation = getAuthGeneration();
  return check(
    (await api.put<Profile>("/profile", input)).data,
    userId,
    generation,
  );
}
export async function updatePassword(userId: string, input: PasswordInput) {
  const generation = getAuthGeneration();
  await api.put("/profile/password", input);
  check(true, userId, generation);
}
export async function saveWallet(
  userId: string,
  input: WalletInput & { id?: string; version?: number },
) {
  const generation = getAuthGeneration();
  return check(
    (
      await (input.id
        ? api.put<Wallet>(`/wallets/${encodeURIComponent(input.id)}`, input)
        : api.post<Wallet>("/wallets", input))
    ).data,
    userId,
    generation,
  );
}
