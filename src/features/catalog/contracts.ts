export const collectionOptions = [
  ["digital-art", "Arte digital"],
  ["photography", "Fotografia"],
  ["music", "Música"],
  ["3d", "Arte 3D"],
  ["collectibles", "Colecionáveis"],
  ["generative", "Generativa"],
  ["games", "Jogos"],
  ["memberships", "Assinaturas"],
  ["utility", "Utilidade"],
] as const;
export type Collection = (typeof collectionOptions)[number][0];
export const networks = ["Ethereum", "Polygon", "Solana"] as const;
export type Network = (typeof networks)[number];
export const sorts = ["recent", "price-asc", "price-desc", "name"] as const;
export type Sort = (typeof sorts)[number];
export const tabs = ["all", "new", "trending"] as const;
export type Tab = (typeof tabs)[number];
export const scenarios = [
  "default",
  "empty",
  "slow",
  "error-once",
  "offline",
  "out-of-order",
] as const;
export type Scenario = (typeof scenarios)[number];
export interface CatalogSearch {
  q: string;
  collections: Collection[];
  networks: Network[];
  minPrice: string;
  maxPrice: string;
  sort: Sort;
  tab: Tab;
  page: number;
  scenario: Scenario;
}
export interface Nft {
  id: string;
  name: string;
  image: string;
  imageAlt: string;
  price: string;
  previousPrice?: string;
  collection: Collection;
  network: Network;
  edition: string;
  available: number;
  createdAt: string;
  trending: boolean;
  isNew: boolean;
  version: number;
}
export interface CatalogResponse {
  items: Nft[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  facets: {
    collections: Record<string, number>;
    networks: Record<string, number>;
  };
}
export interface ApiError {
  code: string;
  message: string;
}
