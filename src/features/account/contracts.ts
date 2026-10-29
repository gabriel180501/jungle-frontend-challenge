import type { User } from "../auth/contracts";
import type { Network, Nft } from "../catalog/contracts";
export interface ProfileInput {
  displayName: string;
  username: string;
  email: string;
  walletNickname: string;
  ens: string;
  avatar: string | null;
}
export interface Profile extends User, ProfileInput {
  version: number;
}
export interface PasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
export const walletTypes = [
  "MetaMask",
  "WalletConnect",
  "Coinbase Wallet",
] as const;
export type WalletType = (typeof walletTypes)[number];
export type WalletRole = "primary" | "secondary";
export interface WalletInput {
  role: WalletRole;
  displayName: string;
  nickname: string;
  profileName: string;
  referralCode: string;
  email: string;
  ens: string;
  secondaryReference: string;
  network: Network;
  address: string;
  walletType: WalletType;
}
export interface Wallet extends WalletInput {
  id: string;
  userId: string;
  version: number;
}
export interface WalletsResponse {
  userId: string;
  items: Wallet[];
}
export interface FavoritesResponse {
  userId: string;
  ids: string[];
  items: Nft[];
  version: number;
}
export interface AccountError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}
