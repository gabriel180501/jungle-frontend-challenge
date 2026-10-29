export type BusinessType = "nft.updated" | "order.updated" | "pricing.updated";
export interface BusinessEvent {
  eventId: string;
  type: BusinessType;
  streamId: string;
  resourceId: string;
  version: number;
  occurredAt: string;
  audience: "public" | string;
  status?: "pending" | "confirmed" | "rejected";
}
export interface Delivery extends BusinessEvent {
  subscriptionId: string;
}
export interface Subscription {
  subscriptionId: string;
  userId: string | null;
}
export interface SyncReady extends Subscription {
  streamId: string;
}
export interface RealtimeState {
  status: "connecting" | "syncing" | "connected" | "disconnected";
  ready: boolean;
  accepted: number;
  ignored: number;
  reconciliations: number;
  notice: string;
  everConnected: boolean;
}
