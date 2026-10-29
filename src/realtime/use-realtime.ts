import { useSyncExternalStore } from "react";
import { realtimeStore } from "./client";
export function useRealtime() {
  return useSyncExternalStore(realtimeStore.subscribe, realtimeStore.get);
}
