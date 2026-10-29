import type {
  Nft,
  Collection,
  Network,
} from "../../features/catalog/contracts";
const artworks = [
  ["emerald-ape", "Macaco de jaqueta verde e óculos redondos"],
  ["sage-nomad", "Macaco de moletom lilás e chapéu verde"],
  ["ivory-baron", "Macaco de terno claro e blusa verde"],
  ["golden-beat", "Macaco dourado de fones de ouvido verdes"],
] as const;
const first = [
  ["Emerald Ape #042", "1.19", 0],
  ["Sage Nomad #009", "1.69", 1],
  ["Neon Vessel #552", "1.99", 2],
  ["Cosmic Bloom #118", "1.29", 1],
  ["Violet Nomad #314", "1.39", 1],
  ["Ivory Baron #088", "1.79", 2],
  ["Golden Beat #207", "0.99", 3],
  ["Golden Echo #301", "0.59", 3],
  ["Golden Signal #160", "0.39", 3],
] as const;
const collectionIds: Collection[] = [
  "digital-art",
  "photography",
  "music",
  "3d",
  "collectibles",
  "generative",
  "games",
  "memberships",
  "utility",
];
const networkNames: Network[] = ["Ethereum", "Polygon", "Solana"];
// Datas, preços e ordem fixos permitem repetir os testes sem depender do relógio.
export const nftFixtures: Nft[] = Array.from({ length: 36 }, (_, index) => {
  const base = first[index % first.length];
  const [art, imageAlt] = artworks[base[2]];
  return {
    id:
      index === 0
        ? "emerald-ape-042"
        : `nft-${String(index + 1).padStart(3, "0")}`,
    name:
      index < 9
        ? base[0]
        : `${base[0].split(" #")[0]} #${String(600 + index).padStart(3, "0")}`,
    image: `/images/${art}.webp`,
    imageAlt,
    price:
      index < 9
        ? base[1]
        : `${Math.floor((index * 17 + 25) / 100)}.${String((index * 17 + 25) % 100).padStart(2, "0")}`,
    ...(index === 2 ? { previousPrice: "2.29" } : {}),
    collection:
      index === 0 ? "digital-art" : collectionIds[index % collectionIds.length],
    network: networkNames[index % 3],
    edition: index % 3 === 0 ? "1/50" : "1/1",
    available: index === 34 ? 0 : index % 3 === 0 ? 5 + (index % 8) : 1,
    createdAt: new Date(Date.UTC(2026, 8, 30 - index)).toISOString(),
    trending: index % 2 === 0,
    isNew: index < 12,
    version: 1,
  };
});
