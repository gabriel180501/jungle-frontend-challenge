import type { Wallet } from "../account/contracts";
import type { CartItem, Quote } from "../cart/contracts";
import type { Network } from "../catalog/contracts";
export interface Collector {
  displayName: string;
  username: string;
  profileName: string;
  referralCode: string;
  email: string;
  ens: string;
  secondaryReference: string;
  note: string;
}
export interface Connection {
  id: string;
  userId: string;
  walletId: string;
  walletVersion: number;
  network: Network;
  connected: boolean;
  expiresAt: string;
}
export interface CheckoutQuote {
  userId: string;
  items: CartItem[];
  otherItems: number;
  quote: Quote;
}
export interface ReviewInput {
  collector: Collector;
  connectionId: string;
}
export interface PurchaseSnapshot extends CheckoutQuote {
  collector: Collector;
  wallet: Wallet;
  network: Network;
}
export interface Review {
  id: string;
  userId: string;
  expiresAt: string;
  connectionId: string;
  snapshot: PurchaseSnapshot;
}
export type OrderStatus = "pending" | "confirmed" | "rejected";
export interface Order {
  version: number;
  id: string;
  userId: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  snapshot: PurchaseSnapshot;
  transaction: string | null;
  reason: string | null;
  attemptKey: string;
}
export interface CheckoutError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}
export interface Attempt {
  key: string;
  reviewId: string;
}
