import { useRealtime } from "./use-realtime";
import { authEvents, getAuthGeneration } from "../features/auth/service";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "../features/auth/context";
import { startRealtime } from "./client";
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const generation = useSyncExternalStore((listener) => {
    authEvents.addEventListener("change", listener);
    return () => authEvents.removeEventListener("change", listener);
  }, getAuthGeneration);
  useEffect(() => {
    if (auth.loading || auth.error) return;
    return startRealtime(auth.user?.id ?? null);
  }, [auth.loading, auth.error, auth.user?.id, auth.expired, generation]);
  return children;
}
export function RealtimeNotice() {
  const realtime = useRealtime();
  return (
    <>
      {((realtime.everConnected && !realtime.ready) ||
        realtime.status === "disconnected") && (
        <div className="session-banner page-width" role="status">
          {realtime.status === "syncing"
            ? "Sincronizando dados com a API…"
            : "Atualizações em tempo real interrompidas. Aguardando reconexão."}
        </div>
      )}
      {realtime.notice && (
        <p className="realtime-notice page-width" role="status">
          {realtime.notice}
        </p>
      )}
    </>
  );
}
