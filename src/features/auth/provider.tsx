import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  authEvents,
  getSessionReason,
  sessionKey,
  sessionOptions,
} from "./service";
import { queryClient } from "../../app/query-client";
import { AuthContext } from "./context";
export function AuthProvider({
  children,
  onSessionChange,
}: {
  children: ReactNode;
  onSessionChange: () => void;
}) {
  const session = useQuery(sessionOptions());
  const [expired, setExpired] = useState(getSessionReason() === "expired");
  useEffect(() => {
    const listener = () => setExpired(getSessionReason() === "expired");
    authEvents.addEventListener("change", listener);
    return () => authEvents.removeEventListener("change", listener);
  }, []);
  const userId = session.data?.user?.id;
  const expiresAt = session.data?.expiresAt;
  useEffect(() => {
    onSessionChange();
  }, [userId, expiresAt, onSessionChange]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(
      () => {
        void queryClient.invalidateQueries({ queryKey: sessionKey });
      },
      Math.max(0, Date.parse(expiresAt) - Date.now() + 50),
    );
    return () => window.clearTimeout(timer);
  }, [expiresAt]);
  return (
    <AuthContext.Provider
      value={{
        user: session.data?.user ?? null,
        loading: session.isPending,
        error: session.isError,
        expired,
        refresh: () => {
          void session.refetch();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
