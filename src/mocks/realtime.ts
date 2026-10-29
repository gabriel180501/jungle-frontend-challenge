import { http, HttpResponse, ws } from "msw";
import { toSocketIo } from "@mswjs/socket.io-binding";
import { inspectSession } from "./auth-database";
import { settleDueOrders } from "./checkout";
import {
  controlRealtime,
  faultEvent,
  isBlocked,
  lastBusiness,
  mockEvents,
  replayBusiness,
  streamId,
} from "./event-bus";
import type {
  BusinessEvent,
  BusinessType,
  Subscription,
} from "../realtime/contracts";
import type { Ping } from "../features/diagnostics/contracts";
const transport = ws.link(`${location.origin.replace(/^http/, "ws")}/`);
interface Slot {
  client: ReturnType<typeof toSocketIo>["client"];
  close: () => void;
  owner: string;
  token: string;
  subscription: Subscription | null;
  drop: boolean;
}
const slots = new Set<Slot>();
let scheduler: ReturnType<typeof setInterval> | undefined;
function identity() {
  const session = inspectSession();
  return {
    owner: session.valid ? session.user!.id : "guest",
    token: session.valid ? session.token : "",
  };
}
function authorized(slot: Slot) {
  const current = identity();
  return current.owner === slot.owner && current.token === slot.token;
}
function deliver(slot: Slot, event: BusinessEvent) {
  if (!slot.subscription || !authorized(slot) || isBlocked(slot.owner)) return;
  if (event.audience !== "public" && event.audience !== slot.owner) return;
  if (slot.drop) {
    slot.drop = false;
    return;
  }
  slot.client.emit(event.type, {
    ...event,
    subscriptionId: slot.subscription.subscriptionId,
  });
}
mockEvents.addEventListener("message", (raw) => {
  const message = (raw as CustomEvent).detail;
  for (const slot of slots) {
    if (message.kind === "business") deliver(slot, message.event);
    if (
      message.kind === "reset" ||
      (message.kind === "control" &&
        message.owner === slot.owner &&
        message.action === "interrupt")
    )
      slot.close();
    if (
      message.kind === "fault" &&
      message.owner === slot.owner &&
      slot.subscription &&
      authorized(slot)
    ) {
      const event = {
        eventId: crypto.randomUUID(),
        streamId: streamId(),
        type: "order.updated",
        resourceId: "unowned-simulation",
        version: 999,
        occurredAt: new Date().toISOString(),
        status: "confirmed",
        audience: message.action === "foreign" ? "another-user" : slot.owner,
        subscriptionId:
          message.action === "old-session"
            ? "previous-subscription"
            : slot.subscription.subscriptionId,
      };
      slot.client.emit("order.updated", event);
    }
  }
});
export const realtimeHandler = transport.addEventListener(
  "connection",
  (connection) => {
    const { client } = toSocketIo(connection),
      current = identity();
    const slot: Slot = {
      client,
      owner: current.owner,
      token: current.token,
      subscription: null,
      drop: false,
      close: () => connection.client.close(1012, "Interrupção simulada"),
    };
    slots.add(slot);
    if (!scheduler)
      scheduler = setInterval(() => {
        void settleDueOrders().catch(() => {
          /* REST continua disponível para recuperar persistência. */
        });
      }, 500);
    const heartbeat = setInterval(() => {
      if (!authorized(slot) || isBlocked(slot.owner)) {
        slot.close();
        return;
      }
      connection.client.send("2");
    }, 20000);
    const blockedTimer = setTimeout(() => {
      if (isBlocked(slot.owner)) slot.close();
    }, 100);
    client.on("session.subscribe", (_event, input: Subscription) => {
      if (
        !input ||
        typeof input.subscriptionId !== "string" ||
        input.subscriptionId.length > 100 ||
        !authorized(slot) ||
        input.userId !== (slot.owner === "guest" ? null : slot.owner) ||
        isBlocked(slot.owner)
      ) {
        slot.close();
        return;
      }
      slot.subscription = input;
      client.emit("sync.ready", { ...input, streamId: streamId() });
    });
    client.on("diagnostics.ping", (_event, payload: Ping) => {
      if (authorized(slot) && !isBlocked(slot.owner))
        client.emit("diagnostics.pong", {
          id: payload.id,
          message: "Evento recebido pelo mock Socket.IO",
        } satisfies Ping);
    });
    connection.client.addEventListener("close", () => {
      clearInterval(heartbeat);
      clearTimeout(blockedTimer);
      slots.delete(slot);
      if (!slots.size && scheduler) {
        clearInterval(scheduler);
        scheduler = undefined;
      }
    });
  },
);
export const realtimeHandlers = [
  http.get("/api/demo/realtime/stats", () => {
    const current = identity();
    return HttpResponse.json({
      connections: [...slots].filter((s) => s.owner === current.owner).length,
      subscriptions: [...slots].filter(
        (s) => s.owner === current.owner && s.subscription,
      ).length,
    });
  }),
  http.post("/api/demo/realtime/control", async ({ request }) => {
    const body = (await request.json()) as {
      action: string;
      type?: BusinessType;
    };
    const { owner } = identity();
    if (["interrupt", "resume"].includes(body.action)) {
      controlRealtime(owner, body.action);
      return new HttpResponse(null, { status: 204 });
    }
    if (body.action === "drop-next") {
      for (const slot of slots) if (slot.owner === owner) slot.drop = true;
      return new HttpResponse(null, { status: 204 });
    }
    if (body.action === "foreign" || body.action === "old-session") {
      faultEvent(owner, body.action);
      return new HttpResponse(null, { status: 204 });
    }
    if (body.action === "duplicate" || body.action === "stale") {
      const type = body.type ?? "nft.updated";
      if (!["nft.updated", "order.updated", "pricing.updated"].includes(type))
        return HttpResponse.json(
          { code: "VALIDATION_ERROR", message: "Tipo inválido." },
          { status: 422 },
        );
      const event = lastBusiness(type, owner);
      if (!event)
        return HttpResponse.json(
          {
            code: "NOT_FOUND",
            message: "Ainda não há evento desse tipo para repetir.",
          },
          { status: 404 },
        );
      replayBusiness(
        body.action === "duplicate"
          ? event
          : {
              ...event,
              eventId: crypto.randomUUID(),
              version: Math.max(1, event.version - 1),
              ...(type === "order.updated"
                ? { status: "pending" as const }
                : {}),
            },
      );
      return new HttpResponse(null, { status: 204 });
    }
    return HttpResponse.json(
      { code: "VALIDATION_ERROR", message: "Ação inválida." },
      { status: 422 },
    );
  }),
];
