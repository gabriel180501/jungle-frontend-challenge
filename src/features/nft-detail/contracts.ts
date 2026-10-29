import type { CatalogSearch, Nft } from "../catalog/contracts";
export const detailScenarios = [
  "default",
  "slow",
  "error-once",
  "offline",
] as const;
export type DetailScenario = (typeof detailScenarios)[number];
export interface DetailSearch extends CatalogSearch {
  edition: string;
  detailScenario: DetailScenario;
}
export interface NftEdition {
  id: string;
  label: string;
  price: string;
  available: number;
  maxPerOrder: number;
}
export interface NftMedia {
  id: string;
  src: string;
  alt: string;
  view: "full" | "face" | "accessory" | "texture";
}
export interface CollectorReview {
  id: string;
  name: string;
  rating: number;
  date: string;
  text: string;
}
export interface NftDetail extends Nft {
  summary: string;
  description: string[];
  tokenId: string;
  collectionName: string;
  creator: string;
  royaltyPercent: number;
  contract: string;
  tokenStandard: string;
  attributes: { label: string; value: string }[];
  media: NftMedia[];
  editions: NftEdition[];
  defaultEditionId: string;
  reviews: CollectorReview[];
  related: Nft[];
}
