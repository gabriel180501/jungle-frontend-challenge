import { queryOptions } from "@tanstack/react-query";
import { CanceledError, isAxiosError } from "axios";
import { api, setUnauthorizedHandler } from "../../lib/api";
import { queryClient } from "../../app/query-client";
import { anonymousSession, type AuthInput, type Session } from "./contracts";
export const sessionKey = ["session"] as const;
export const authEvents = new EventTarget();
let reason: "" | "expired" = "";
let epoch = 0;
let authController: AbortController | null = null;
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("kurio-auth")
    : null;
export function getSessionReason() {
  return reason;
}
function notify() {
  authEvents.dispatchEvent(new Event("change"));
}
function clearPrivate() {
  void queryClient.cancelQueries({
    predicate: (query) =>
      query.queryKey[0] === "private" || query.queryKey[0] === "cart",
  });
  queryClient.removeQueries({
    predicate: (query) =>
      query.queryKey[0] === "private" || query.queryKey[0] === "cart",
  });
  queryClient.getMutationCache().clear();
}
setUnauthorizedHandler(() => {
  epoch += 1;
  reason = "expired";
  clearPrivate();
  queryClient.setQueryData(sessionKey, anonymousSession);
  notify();
});
export function sessionOptions() {
  return queryOptions({
    queryKey: sessionKey,
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const requestEpoch = epoch;
      try {
        const session = (await api.get<Session>("/session", { signal })).data;
        if (requestEpoch !== epoch) throw new CanceledError("Sessão alterada");
        const previous = queryClient.getQueryData<Session>(sessionKey);
        if (previous?.user && previous.user.id !== session.user?.id)
          clearPrivate();
        return session;
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 401)
          return anonymousSession;
        throw error;
      }
    },
  });
}
async function applySession(session: Session) {
  epoch += 1;
  await queryClient.cancelQueries({ queryKey: sessionKey });
  clearPrivate();
  reason = "";
  queryClient.setQueryData(sessionKey, session);
  notify();
  channel?.postMessage("changed");
}
export async function submitAuth(
  register: boolean,
  input: AuthInput,
): Promise<Session> {
  const requestEpoch = ++epoch;
  authController?.abort();
  authController = new AbortController();
  await queryClient.cancelQueries({ queryKey: sessionKey });
  const body = register
    ? input
    : { email: input.email, password: input.password };
  const session = (
    await api.post<Session>(register ? "/auth/register" : "/auth/login", body, {
      signal: authController.signal,
    })
  ).data;
  if (requestEpoch !== epoch)
    throw new CanceledError("Operação de autenticação substituída");
  await applySession(session);
  return session;
}
export async function logout() {
  epoch += 1;
  authController?.abort();
  await api.post("/auth/logout");
  await applySession(anonymousSession);
}
export async function resetDemo() {
  epoch += 1;
  authController?.abort();
  await api.post("/demo/reset");
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith("kurio.attempt."))
    .forEach((key) => sessionStorage.removeItem(key));
  await applySession(anonymousSession);
  await queryClient.resetQueries({
    predicate: (query) =>
      query.queryKey[0] !== "session" && query.queryKey[0] !== "private",
  });
}
export async function expireDemoSession() {
  await api.post("/demo/session/expire");
  await queryClient.invalidateQueries({ queryKey: sessionKey });
}
channel?.addEventListener("message", () => {
  reason = "";
  epoch += 1;
  authController?.abort();
  clearPrivate();
  queryClient.setQueryData(sessionKey, anonymousSession);
  void queryClient.invalidateQueries({ queryKey: sessionKey });
  notify();
});

export function getAuthGeneration() {
  return epoch;
}
export async function refreshIdentity() {
  await queryClient.invalidateQueries({ queryKey: sessionKey });
  channel?.postMessage("changed");
}
