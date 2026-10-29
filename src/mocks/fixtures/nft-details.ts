import { marketDetail } from "../market-state";
import type { NftDetail } from "../../features/nft-detail/contracts";
import { multiplyEth } from "../../lib/eth";
import { nftFixtures } from "./nfts";
const collectors = [
  "Lia M.",
  "Rafael C.",
  "Ana P.",
  "Bruno S.",
  "Bia L.",
  "Caio A.",
  "Dani R.",
  "Enzo F.",
  "Isa V.",
  "João T.",
  "Luca B.",
  "Maia O.",
  "Nina D.",
  "Otávio G.",
  "Pedro K.",
  "Rita N.",
  "Sofia E.",
  "Theo J.",
  "Vera H.",
];
const comments = [
  "Gostei dos detalhes da arte e da identidade da coleção.",
  "As cores e os atributos tornam esta peça uma das minhas favoritas.",
  "Uma obra interessante para acompanhar o trabalho do criador.",
  "Boa composição e apresentação dos detalhes do personagem.",
];
const detailFixtures = new Map<string, NftDetail>(
  nftFixtures.map((nft, index) => {
    const soldOut = nft.available === 0;
    const defaultEditionId = nft.edition === "1/50" ? "limited-50" : "unique";
    const tokenId = `#${(nft.name.split("#")[1] || String(index + 1)).padStart(4, "0")}`;
    const description = `${nft.name} é uma peça de arte digital da coleção Kurio Apes. A composição explora identidade, luz e os detalhes de cada personagem.`;
    return [
      nft.id,
      {
        ...nft,
        summary: `Uma peça da coleção Kurio Apes, com atributos selecionados e procedência demonstrativa na rede ${nft.network}.`,
        description: [
          description,
          "A coleção apresenta personagens com cores e acessórios próprios. Nesta demonstração, os dados de rede, contrato e propriedade são simulados; nenhuma transação é realizada em blockchain.",
        ],
        tokenId,
        collectionName: "Kurio Apes",
        creator: "Nova Sato",
        royaltyPercent: 5,
        contract:
          nft.network === "Solana"
            ? `KURIO-SIM-${String(index + 42).padStart(8, "0")}`
            : `0x${(index + 42).toString(16).padStart(40, "0")}`,
        tokenStandard:
          nft.network === "Solana"
            ? "Metaplex (simulado)"
            : nft.edition === "1/50"
              ? "ERC-1155 (simulado)"
              : "ERC-721 (simulado)",
        attributes: [
          { label: "Estilo", value: "Retrato digital" },
          {
            label: "Acessório",
            value: nft.image.includes("golden")
              ? "Fones de ouvido"
              : nft.image.includes("sage")
                ? "Chapéu"
                : nft.image.includes("emerald")
                  ? "Óculos"
                  : "Terno",
          },
          {
            label: "Raridade",
            value: index % 2 === 0 ? "Raro" : "Selecionado",
          },
        ],
        media: [
          { id: "full", src: nft.image, alt: nft.imageAlt, view: "full" },
          {
            id: "face",
            src: nft.image,
            alt: `Detalhe do rosto: ${nft.imageAlt.toLowerCase()}`,
            view: "face",
          },
          {
            id: "accessory",
            src: nft.image,
            alt: `Detalhe dos acessórios: ${nft.imageAlt.toLowerCase()}`,
            view: "accessory",
          },
          {
            id: "texture",
            src: nft.image,
            alt: `Detalhe da vestimenta: ${nft.imageAlt.toLowerCase()}`,
            view: "texture",
          },
        ],
        editions: [
          {
            id: "unique",
            label: "1/1",
            price:
              defaultEditionId === "unique"
                ? nft.price
                : multiplyEth(nft.price, 3),
            available: soldOut ? 0 : 1,
            maxPerOrder: 1,
          },
          {
            id: "limited-10",
            label: "1/10",
            price: multiplyEth(nft.price, 2),
            available: soldOut || index === 0 ? 0 : 2,
            maxPerOrder: 2,
          },
          {
            id: "limited-50",
            label: "1/50",
            price: nft.price,
            available: soldOut
              ? 0
              : defaultEditionId === "limited-50"
                ? nft.available
                : 6,
            maxPerOrder: 3,
          },
          {
            id: "open",
            label: "ABERTA",
            price: nft.price,
            available: soldOut ? 0 : 12,
            maxPerOrder: 5,
          },
        ],
        defaultEditionId,
        reviews: collectors.map((name, reviewIndex) => ({
          id: `review-${index}-${reviewIndex}`,
          name,
          rating: reviewIndex < 15 ? 5 : 4,
          date: `2026-09-${String(20 - reviewIndex).padStart(2, "0")}`,
          text: comments[reviewIndex % comments.length],
        })),
        related: nftFixtures
          .filter(
            (candidate) => candidate.id !== nft.id && candidate.available > 0,
          )
          .slice(0, 5),
      } satisfies NftDetail,
    ];
  }),
);
export function getNftDetail(id: string): NftDetail | undefined {
  const detail = detailFixtures.get(id);
  if (!detail) return undefined;
  const live = marketDetail(detail);
  return {
    ...live,
    related: detail.related.map((nft) => {
      const base = detailFixtures.get(nft.id);
      const current = base ? marketDetail(base) : undefined;
      return {
        ...nft,
        price: current?.price ?? nft.price,
        available: current?.available ?? nft.available,
        version: current?.version ?? nft.version,
      };
    }),
  };
}
