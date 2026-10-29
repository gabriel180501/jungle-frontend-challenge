import { FavoriteButton } from "../account/favorite-button";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { formatEth } from "../../lib/eth";
import type { CatalogSearch, Nft } from "./contracts";
export function NftCard({ nft, search, priority = false }: { nft: Nft; search: CatalogSearch; priority?: boolean }) {
  return (
    <article className="nft-card" data-testid="nft-card" data-price={nft.price}>
      <Link
        to="/nfts/$nftId"
        params={{ nftId: nft.id }}
        search={{ ...search, edition: "", detailScenario: "default" }}
        className="nft-card-link"
      >
        <div className="nft-image-wrap">
          <img
            src={nft.image}
            alt={nft.imageAlt}
            width="640"
            height="640"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
          />
          {nft.previousPrice && <span className="nft-badge">OFERTA</span>}
          {nft.available === 0 && <span className="sold-out">Esgotado</span>}
          <span className="card-arrow" aria-hidden="true">
            <ArrowUpRight size={20} />
          </span>
        </div>
        <h3>{nft.name}</h3>
        <p className="nft-price">
          {formatEth(nft.price)} ETH{" "}
          {nft.previousPrice && <del>{formatEth(nft.previousPrice)} ETH</del>}
        </p>
      </Link>
      <FavoriteButton nft={nft} compact className="card-favorite" />
    </article>
  );
}
