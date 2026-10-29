import type { BusinessEvent, BusinessType } from "../realtime/contracts";
const key = "kurio.mock.events.v1";
interface EventState {
  streamId: string;
  log: BusinessEvent[];
  blocked: string[];
}
function load(): EventState {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (value?.streamId && Array.isArray(value.log))
      return { ...value, blocked: value.blocked ?? [] };
  } catch {
    /* Recria o cenário. */
  }
  const state = { streamId: crypto.randomUUID(), log: [], blocked: [] };
  localStorage.setItem(key, JSON.stringify(state));
  return state;
}
export const mockEvents = new EventTarget();
const channel = new BroadcastChannel("kurio-mock-events");
channel.addEventListener("message", (event) =>
  mockEvents.dispatchEvent(new CustomEvent("message", { detail: event.data })),
);
function notify(data: unknown) {
  mockEvents.dispatchEvent(new CustomEvent("message", { detail: data }));
  channel.postMessage(data);
}
export function streamId() {
  return load().streamId;
}
export function emitBusiness(
  type: BusinessType,
  resourceId: string,
  version: number,
  audience: string,
  status?: BusinessEvent["status"],
) {
  const state = load();
  const event: BusinessEvent = {
    eventId: crypto.randomUUID(),
    type,
    resourceId,
    version,
    audience,
    streamId: state.streamId,
    occurredAt: new Date().toISOString(),
    ...(status ? { status } : {}),
  };
  state.log.push(event);
  state.log = state.log.slice(-100);
  localStorage.setItem(key, JSON.stringify(state));
  notify({ kind: "business", event });
  return event;
}
export function replayBusiness(event: BusinessEvent) {
  notify({ kind: "business", event });
}
export function lastBusiness(type: BusinessType, owner: string) {
  return load()
    .log.filter(
      (e) =>
        e.type === type && (e.audience === "public" || e.audience === owner),
    )
    .at(-1);
}
export function isBlocked(owner: string) {
  return load().blocked.includes(owner);
}
export function controlRealtime(owner: string, action: string) {
  const state = load();
  state.blocked =
    action === "interrupt"
      ? [...new Set([...state.blocked, owner])]
      : state.blocked.filter((id) => id !== owner);
  localStorage.setItem(key, JSON.stringify(state));
  notify({ kind: "control", owner, action });
}
export function faultEvent(owner: string, action: "foreign" | "old-session") {
  notify({ kind: "fault", owner, action });
}
export function resetEvents() {
  localStorage.removeItem(key);
  load();
  notify({ kind: "reset" });
}
