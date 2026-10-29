import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../auth/context";
import { favoritesOptions } from "./api";
import { NftCard } from "../catalog/nft-card";
import { defaultSearch } from "../catalog/search";
import { Button } from "../../components/ui/button";
export function FavoritesPanel() {
  const userId = useAuth().user?.id;
  const query = useQuery(favoritesOptions(userId));
  if (!userId) return null;
  if (query.isPending)
    return (
      <div
        className="skeleton account-skeleton"
        role="status"
        aria-label="Carregando favoritos"
      />
    );
  if (query.isError)
    return (
      <div role="alert">
        <p>Não foi possível carregar seus favoritos.</p>
        <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>
    );
  return (
    <div className="favorites-panel">
      <p className="account-intro" role="status">
        {query.data.items.length} NFTs na sua lista de interesse.
      </p>
      {query.data.items.length ? (
        <div className="nft-grid">
          {query.data.items.map((nft) => (
            <NftCard key={nft.id} nft={nft} search={defaultSearch} />
          ))}
        </div>
      ) : (
        <div className="catalog-message">
          <h2>Sua lista ainda está vazia.</h2>
          <p>Toque no coração de um NFT para guardá-lo aqui.</p>
          <Button asChild>
            <Link to="/" search={defaultSearch} hash="catalogo">
              Explorar NFTs
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
