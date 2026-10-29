import type { Connection, Order, Review } from "../features/checkout/contracts";
export const orderKey = "kurio.mock.orders.v1";
export interface InternalOrder extends Order {
  reviewId: string;
  resolveAt: number;
  outcome: "confirm" | "reject" | "pending";
}
interface StoredConnection extends Connection {
  token: string;
}
export interface Settings {
  wallet: "connect" | "refuse" | "disconnect";
  order:
    | "confirm"
    | "reject"
    | "pending"
    | "timeout-confirm"
    | "fail-once"
    | "offline";
}
export interface OrdersDB {
  connections: Record<string, StoredConnection>;
  reviews: Record<string, Review>;
  orders: Record<string, InternalOrder>;
  settings: Record<string, Settings>;
}
export function loadOrders(): OrdersDB {
  try {
    const value = JSON.parse(localStorage.getItem(orderKey) ?? "null");
    if (
      value?.orders &&
      value?.reviews &&
      value?.connections &&
      value?.settings
    ) {
      for (const order of Object.values(value.orders) as InternalOrder[])
        order.version ??= order.status === "pending" ? 1 : 2;
      return value;
    }
  } catch {
    /* Recria estado inválido. */
  }
  return { connections: {}, reviews: {}, orders: {}, settings: {} };
}
export function saveOrders(db: OrdersDB) {
  localStorage.setItem(orderKey, JSON.stringify(db));
}
export function resetOrders() {
  localStorage.removeItem(orderKey);
}
export function publicOrder(order: InternalOrder): Order {
  const {
    reviewId: _reviewId,
    resolveAt: _resolveAt,
    outcome: _outcome,
    ...result
  } = order;
  return result;
}
export function atomic<T>(operation: () => T): T {
  const keys = [
    orderKey,
    "kurio.mock.carts.v1",
    "kurio.mock.market.v1",
    "kurio.mock.events.v1",
  ];
  const old = keys.map((key) => localStorage.getItem(key));
  try {
    return operation();
  } catch (error) {
    keys.forEach((key, i) => {
      if (old[i] === null) localStorage.removeItem(key);
      else localStorage.setItem(key, old[i]!);
    });
    throw error;
  }
}
export const commerceLock = <T>(operation: () => T | Promise<T>) =>
  navigator.locks.request("kurio-commerce", operation);
export function settings(userId: string) {
  return (
    loadOrders().settings[userId] ?? { wallet: "connect", order: "confirm" }
  );
}
