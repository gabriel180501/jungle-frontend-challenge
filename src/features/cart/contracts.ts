export interface CartInput {
  nftId: string;
  editionId: string;
  quantity: number;
}
export interface StoredCart {
  items: CartInput[];
  coupon: string;
  version: number;
  notices: string[];
}
export interface CartItem extends CartInput {
  id: string;
  name: string;
  image: string;
  tokenId: string;
  edition: string;
  network: string;
  unitPrice: string;
  total: string;
  available: number;
  limit: number;
  problem: string;
}
export interface Cart {
  owner: string;
  version: number;
  items: CartItem[];
  coupon: string;
  notices: string[];
}
export interface Quote {
  owner: string;
  cartVersion: number;
  fingerprint: string;
  expiresAt: string;
  subtotal: string;
  discount: string;
  networkFee: string;
  total: string;
  coupon: string;
  couponError: string;
  valid: boolean;
  problems: string[];
}
export interface CartError {
  code: string;
  message: string;
}
export const itemId = (nftId: string, editionId: string) =>
  `${nftId}:${editionId}`;
