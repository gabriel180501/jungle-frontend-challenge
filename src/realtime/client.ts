import { io, type Socket } from "socket.io-client";
import { queryClient } from "../app/query-client";
import { authEvents, getAuthGeneration } from "../features/auth/service";
import type { Delivery, RealtimeState, SyncReady } from "./contracts";
import type { Nft } from "../features/catalog/contracts";
import type { Order } from "../features/checkout/contracts";
let state: RealtimeState = {
  status: "connecting",
  ready: false,
  accepted: 0,
  ignored: 0,
  reconciliations: 0,
  notice: "",
  everConnected: false,
};
const listeners = new Set<() => void>();
export const realtimeStore = {
  get: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
function update(patch: Partial<RealtimeState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
function related(queryKey: readonly unknown[], userId: string | null) {
  return (
    queryKey[0] === "nfts" ||
    (queryKey[0] === "cart" &&
      queryKey[1] === (userId ? `user:${userId}` : "guest")) ||
    (queryKey[0] === "private" &&
      queryKey[1] === userId &&
      ["checkout-quote", "orders", "favorites"].includes(String(queryKey[2])))
  );
}
export function startRealtime(userId: string | null) {
  let stopped = false,
    active = true,
    subscriptionId = "",
    stream = "",
    syncing = false,
    dirty = false,
    connected = false;
  const seenIds = new Set<string>();
  const versions = new Map<string, number>(),
    terminal = new Set<string>();
  let generation = getAuthGeneration();
  const socket: Socket = io(location.origin, {
    transports: ["websocket"],
    autoConnect: false,
    forceNew: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 2000,
    randomizationFactor: 0,
  });
  const current = () =>
    !stopped && active && generation === getAuthGeneration();
  function absorb() {
    function record(
      type: string,
      item: { id: string; version?: number; status?: string },
    ) {
      if (!Number.isSafeInteger(item.version)) return;
      const key = `${type}:${item.id}`;
      versions.set(key, Math.max(versions.get(key) ?? 0, item.version!));
      if (type === "order.updated" && item.status && item.status !== "pending")
        terminal.add(item.id);
    }
    for (const query of queryClient.getQueryCache().getAll()) {
      if (!related(query.queryKey, userId)) continue;
      const data = query.state.data as
        | {
            id?: string;
            version?: number;
            items?: unknown[];
            related?: unknown[];
            status?: string;
          }
        | undefined;
      if (!data) continue;
      if (query.queryKey[0] === "nfts") {
        if (data.id) record("nft.updated", data as Nft);
        for (const item of [...(data.items ?? []), ...(data.related ?? [])])
          record("nft.updated", item as Nft);
      }
      if (query.queryKey[0] === "private" && query.queryKey[2] === "orders") {
        if (data.id) record("order.updated", data as Order);
        for (const item of data.items ?? [])
          record("order.updated", item as Order);
      }
    }
  }
  let fullSyncRequested = false;
  async function reconcile(initial = false) {
    dirty = true;
    if (!initial) fullSyncRequested = true;
    if (syncing) return;
    syncing = true;
    update({ ready: false, status: "syncing" });
    try {
      while (dirty && current() && connected) {
        dirty = false;
        const full = fullSyncRequested;
        fullSyncRequested = false;
        const predicate = (query: {
          queryKey: readonly unknown[];
          state: { data: unknown };
        }) =>
          related(query.queryKey, userId) &&
          (full || query.state.data !== undefined);
        if (full) await queryClient.cancelQueries({ predicate });
        await queryClient.invalidateQueries({ predicate });
        if (current()) absorb();
      }
      if (current() && connected)
        update({
          status: "connected",
          ready: true,
          reconciliations: state.reconciliations + 1,
        });
    } finally {
      syncing = false;
    }
  }
  function receive(event: Delivery) {
    if (!current()) return;
    if (
      !connected ||
      !event ||
      event.subscriptionId !== subscriptionId ||
      event.streamId !== stream ||
      typeof event.eventId !== "string" ||
      typeof event.resourceId !== "string" ||
      !Number.isSafeInteger(event.version) ||
      event.version < 1 ||
      !["nft.updated", "order.updated", "pricing.updated"].includes(
        event.type,
      ) ||
      (event.audience !== "public" && event.audience !== userId) ||
      (event.type === "order.updated" &&
        (event.audience === "public" ||
          !["pending", "confirmed", "rejected"].includes(event.status ?? "")))
    ) {
      update({ ignored: state.ignored + 1 });
      return;
    }
    absorb();
    const key = `${event.type}:${event.resourceId}`;
    if (
      seenIds.has(event.eventId) ||
      event.version <= (versions.get(key) ?? 0) ||
      (event.type === "order.updated" &&
        terminal.has(event.resourceId) &&
        event.status === "pending")
    ) {
      update({ ignored: state.ignored + 1 });
      return;
    }
    seenIds.add(event.eventId);
    if (seenIds.size > 256) seenIds.delete(seenIds.values().next().value!);
    versions.set(key, event.version);
    if (event.type === "order.updated" && event.status !== "pending")
      terminal.add(event.resourceId);
    update({
      accepted: state.accepted + 1,
      notice:
        event.type === "nft.updated"
          ? "Preço ou disponibilidade de NFT alterado. Confira os valores atualizados."
          : event.type === "order.updated"
            ? "O pedido recebeu uma atualização. Consultando o estado na API."
            : "Taxa ou validade do cupom alterada. Confira a cotação.",
    });
    void reconcile();
  }
  function onConnect() {
    if (!current()) return;
    subscriptionId = crypto.randomUUID();
    connected = false;
    update({ ready: false, status: "syncing" });
    socket.emit("session.subscribe", { subscriptionId, userId });
  }
  function onReady(message: SyncReady) {
    if (
      !current() ||
      message.subscriptionId !== subscriptionId ||
      message.userId !== userId
    )
      return;
    if (stream && stream !== message.streamId) {
      seenIds.clear();
      versions.clear();
      terminal.clear();
    }
    const initial = !stream;
    stream = message.streamId;
    connected = true;
    update({ everConnected: true });
    void reconcile(initial);
  }
  function onDisconnect() {
    if (!current()) return;
    connected = false;
    update({ ready: false, status: "disconnected" });
  }
  function stopSession() {
    active = false;
    connected = false;
    socket.removeAllListeners();
    socket.disconnect();
    if (!stopped) update({ ready: false, status: "connecting", notice: "" });
  }
  authEvents.addEventListener("change", stopSession);
  socket.on("connect", onConnect);
  socket.on("sync.ready", onReady);
  socket.on("disconnect", onDisconnect);
  socket.on("connect_error", onDisconnect);
  socket.on("nft.updated", receive);
  socket.on("order.updated", receive);
  socket.on("pricing.updated", receive);
  update({
    status: "connecting",
    ready: false,
    notice: "",
    accepted: 0,
    ignored: 0,
    reconciliations: 0,
    everConnected: false,
  });
  socket.connect();
  return () => {
    stopped = true;
    active = false;
    authEvents.removeEventListener("change", stopSession);
    socket.removeAllListeners();
    socket.disconnect();
  };
}
