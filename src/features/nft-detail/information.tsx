import { useState } from "react";
import { Star } from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import type { NftDetail } from "./contracts";
export function NftInformation({
  nft,
  tab,
  onTabChange,
}: {
  nft: NftDetail;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  const [reviewPage, setReviewPage] = useState(1);
  const reviews = nft.reviews.slice(0, reviewPage * 5);
  return (
    <Tabs
      value={tab}
      onValueChange={onTabChange}
      className="nft-information"
      id="nft-information"
    >
      <TabsList aria-label="Informações do NFT">
        <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
        <TabsTrigger value="reviews">
          Avaliações de colecionadores ({nft.reviews.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details">
        <div className="description-copy">
          {nft.description.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <dl className="provenance">
          <div>
            <dt>Rede</dt>
            <dd>{nft.network} · Dados de procedência simulados</dd>
          </div>
          <div>
            <dt>Contrato</dt>
            <dd className="contract-address">
              {nft.contract}
              <br />
              {nft.tokenStandard}
            </dd>
          </div>
          <div>
            <dt>Direitos autorais do criador</dt>
            <dd>
              {nft.royaltyPercent}% nas vendas secundárias, conforme os dados
              simulados da coleção.
            </dd>
          </div>
          <div>
            <dt>Criador</dt>
            <dd>{nft.creator}</dd>
          </div>
        </dl>
      </TabsContent>
      <TabsContent value="reviews">
        <p className="reviews-intro">
          Avaliações fictícias para demonstração da interface.
        </p>
        <div className="review-list">
          {reviews.map((review) => (
            <article className="collector-review" key={review.id}>
              <header>
                <h3>{review.name}</h3>
                <span
                  className="review-score"
                  aria-label={`${review.rating} de 5 estrelas`}
                >
                  <Star size={14} fill="currentColor" aria-hidden="true" />
                  {review.rating}/5
                </span>
                <time dateTime={review.date}>
                  {new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
                    new Date(review.date),
                  )}
                </time>
              </header>
              <p>{review.text}</p>
            </article>
          ))}
        </div>
        <p className="review-count" role="status">
          Exibindo {reviews.length} de {nft.reviews.length} avaliações
        </p>
        {reviews.length < nft.reviews.length && (
          <Button
            variant="outline"
            onClick={() => setReviewPage((page) => page + 1)}
          >
            Mostrar mais avaliações
          </Button>
        )}
      </TabsContent>
    </Tabs>
  );
}
