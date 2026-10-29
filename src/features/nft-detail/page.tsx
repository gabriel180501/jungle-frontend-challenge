import { cartError, useCartBusy, useCartMutation } from "../cart/api";
import { FavoriteButton } from "../account/favorite-button";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowLeft, Minus, Plus, RefreshCw, ShoppingBag } from "lucide-react";
import { nftDetailOptions } from "./api";
import type { DetailSearch, NftDetail } from "./contracts";
import { NftGallery } from "./gallery";
import { NftInformation } from "./information";
import { ShareNft } from "./share-dialog";
import { parseCatalogSearch } from "../catalog/search";
import { NftCard } from "../catalog/nft-card";
import { Button } from "../../components/ui/button";
import { formatEth, multiplyEth } from "../../lib/eth";

export function NftDetailPage() {
  const { nftId } = useParams({ from: "/nfts/$nftId" });
  const search = useSearch({ from: "/nfts/$nftId" });
  const query = useQuery(nftDetailOptions(nftId, search.detailScenario));
  const missing =
    isAxiosError(query.error) && query.error.response?.status === 404;
  const nftName = query.data?.name;
  useEffect(() => {
    document.title = nftName
      ? `${nftName} — Kurio`
      : missing
        ? "NFT não encontrado — Kurio"
        : "Detalhes do NFT — Kurio";
    return () => {
      document.title = "Kurio — Arte digital para colecionar";
    };
  }, [nftName, missing]);
  return (
    <div className="nft-detail-page page-width">
      <nav className="nft-breadcrumbs" aria-label="Caminho da página">
        <Link to="/" search={parseCatalogSearch({ ...search })}>
          Início
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/" search={parseCatalogSearch({ ...search })} hash="catalogo">
          Mercado
        </Link>
        {query.data && (
          <>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{query.data.name}</span>
          </>
        )}
      </nav>
      <Link
        to="/"
        search={parseCatalogSearch({ ...search })}
        hash="catalogo"
        className="detail-back-link"
      >
        <ArrowLeft size={18} /> Voltar ao catálogo
      </Link>
      {!query.data ? (
        query.isPending ? (
          <DetailSkeleton />
        ) : (
          <section
            className="detail-error catalog-message"
            role={missing ? undefined : "alert"}
          >
            <h1>
              {missing
                ? "NFT não encontrado."
                : "Não foi possível carregar este NFT."}
            </h1>
            <p>
              {missing
                ? "Este endereço não corresponde a uma peça disponível no catálogo."
                : "Confira sua conexão e tente novamente."}
            </p>
            {!missing && (
              <Button
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                <RefreshCw size={16} /> Tentar novamente
              </Button>
            )}
            <Button asChild variant="outline">
              <Link
                to="/"
                search={parseCatalogSearch({ ...search })}
                hash="catalogo"
              >
                Explorar catálogo
              </Link>
            </Button>
          </section>
        )
      ) : (
        <>
          {query.isError && (
            <div className="detail-refresh-error" role="alert">
              <p>
                Não conseguimos atualizar os dados. Tente novamente antes de
                continuar.
              </p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                Atualizar NFT
              </Button>
            </div>
          )}
          <DetailContent
            key={nftId}
            nft={query.data}
            search={search}
            blocked={query.isFetching || query.isError}
          />
        </>
      )}
    </div>
  );
}
function DetailContent({
  nft,
  search,
  blocked,
}: {
  nft: NftDetail;
  search: DetailSearch;
  blocked: boolean;
}) {
  const navigate = useNavigate({ from: "/nfts/$nftId" });
  const selectedId = search.edition || nft.defaultEditionId;
  const selected = nft.editions.find((edition) => edition.id === selectedId);
  const [quantityState, setQuantityState] = useState({
    editionId: selectedId,
    value: "1",
  });
  const quantityText =
    quantityState.editionId === selectedId ? quantityState.value : "1";
  const quantity = /^\d+$/.test(quantityText) ? Number(quantityText) : NaN;
  const maxQuantity = selected
    ? Math.min(selected.available, selected.maxPerOrder)
    : 0;
  const quantityValid =
    Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= maxQuantity;
  const quantityError =
    maxQuantity > 0 && !quantityValid
      ? `Escolha uma quantidade inteira entre 1 e ${maxQuantity}.`
      : "";
  const [tab, setTab] = useState("details");
  const cartMutation = useCartMutation();
  const cartBusy = useCartBusy();
  const rating = (
    nft.reviews.reduce((total, review) => total + review.rating, 0) /
    nft.reviews.length
  ).toFixed(1);
  const allSoldOut = nft.editions.every((edition) => edition.available === 0);
  function setQuantity(value: string) {
    setQuantityState({ editionId: selectedId, value });
  }
  function addToCart() {
    if (!selected || !quantityValid || cartBusy) return;
    cartMutation.mutate(
      {
        kind: "add",
        item: { nftId: nft.id, editionId: selected.id, quantity },
      },
      {
        onSuccess: () => {
          void navigate({ to: "/cart" });
        },
      },
    );
  }
  function showReviews() {
    setTab("reviews");
    document
      .getElementById("nft-information")
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  }
  return (
    <>
      <div className="nft-detail-layout">
        <NftGallery media={nft.media} name={nft.name} />
        <section className="nft-product-info" aria-labelledby="nft-title">
          <div className="product-title-row">
            <h1 id="nft-title">{nft.name}</h1>
            <FavoriteButton nft={nft} compact className="mobile-favorite" />
          </div>
          <div className="product-price-rating">
            <p className="detail-unit-price" data-testid="unit-price">
              {formatEth(selected?.price ?? nft.price)} ETH
            </p>
            <button
              onClick={showReviews}
              className="rating-link"
              aria-label={`Ver ${nft.reviews.length} avaliações, nota ${rating}`}
            >
              <span className="rating-stars" aria-hidden="true">
                ★★★★★
              </span>
              <span>
                {rating.replace(".", ",")} · {nft.reviews.length} avaliações
              </span>
            </button>
          </div>
          <div className="product-summary">
            <h2>Sobre este NFT</h2>
            <p>{nft.summary}</p>
          </div>
          <fieldset className="edition-selector">
            <legend>Edição</legend>
            <div>
              {nft.editions.map((edition) => (
                <label
                  key={edition.id}
                  className={
                    edition.available === 0 ? "edition-unavailable" : undefined
                  }
                >
                  <input
                    type="radio"
                    name="edition"
                    value={edition.id}
                    checked={selectedId === edition.id}
                    disabled={edition.available === 0}
                    onChange={() => {
                      setQuantityState({ editionId: edition.id, value: "1" });
                      void navigate({
                        search: (previous) => ({
                          ...previous,
                          edition: edition.id,
                        }),
                        resetScroll: false,
                      });
                    }}
                  />
                  <span>{edition.label}</span>
                  <span className="sr-only">
                    {edition.available === 0 ? " · esgotada" : ""}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="edition-stock" role="status">
            {!selected
              ? "Edição não encontrada. Selecione uma das opções disponíveis."
              : allSoldOut
                ? "NFT esgotado. Nenhuma edição está disponível."
                : selected.available === 0
                  ? "Esta edição está esgotada. Escolha outra edição."
                  : `${selected.available} ${selected.available === 1 ? "unidade disponível" : "unidades disponíveis"} · Limite de ${maxQuantity} por pedido.`}
            {blocked && " Atualizando dados…"}
          </p>
          <dl className="nft-metadata">
            <div>
              <dt>ID do token:</dt>
              <dd>{nft.tokenId}</dd>
            </div>
            <div>
              <dt>Coleção:</dt>
              <dd>{nft.collectionName}</dd>
            </div>
            <div>
              <dt>Atributos:</dt>
              <dd>
                {nft.attributes.map((attribute) => attribute.value).join(", ")}
              </dd>
            </div>
          </dl>
          <div className="product-purchase-panel">
            <div className="quantity-and-total">
              <div className="quantity-field">
                <label htmlFor="nft-quantity">Qtd.</label>
                <div className="quantity-stepper">
                  <button
                    aria-label="Diminuir quantidade"
                    disabled={!quantityValid || quantity <= 1 || blocked}
                    onClick={() => setQuantity(String(quantity - 1))}
                  >
                    <Minus size={17} />
                  </button>
                  <input
                    id="nft-quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={maxQuantity || 1}
                    step={1}
                    value={quantityText}
                    disabled={maxQuantity === 0 || blocked}
                    aria-invalid={!!quantityError}
                    aria-describedby={
                      quantityError ? "quantity-error" : "quantity-hint"
                    }
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                  <button
                    aria-label="Aumentar quantidade"
                    disabled={
                      !quantityValid || quantity >= maxQuantity || blocked
                    }
                    onClick={() => setQuantity(String(quantity + 1))}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </div>
              <div className="selection-total" role="status">
                <span>Total dos itens</span>
                <strong data-testid="selection-total">
                  {selected && quantityValid
                    ? `${formatEth(multiplyEth(selected.price, quantity))} ETH`
                    : "—"}
                </strong>
              </div>
            </div>
            <p id="quantity-hint" className="quantity-hint">
              Quantidade inteira. Taxas serão calculadas na compra.
            </p>
            {quantityError && (
              <p id="quantity-error" className="field-error" role="alert">
                {quantityError}
              </p>
            )}
            <div className="purchase-actions">
              <Button
                onClick={addToCart}
                disabled={!selected || !quantityValid || blocked || cartBusy}
              >
                <ShoppingBag size={17} />
                {allSoldOut || selected?.available === 0
                  ? "Esgotado"
                  : cartBusy
                    ? "Adicionando…"
                    : "Comprar NFT"}
              </Button>
              <FavoriteButton nft={nft} className="desktop-favorite" />
            </div>
          </div>
          {cartMutation.isError && (
            <p className="field-error" role="alert">
              {cartError(cartMutation.error)}
            </p>
          )}
          <ShareNft id={nft.id} edition={selected?.id ?? ""} />
        </section>
      </div>
      <NftInformation nft={nft} tab={tab} onTabChange={setTab} />
      <section className="related-nfts" aria-labelledby="related-title">
        <h2 id="related-title">Mais desta coleção</h2>
        <div className="related-grid">
          {nft.related.map((item) => (
            <NftCard
              key={item.id}
              nft={item}
              search={parseCatalogSearch({ ...search })}
            />
          ))}
        </div>
      </section>
    </>
  );
}
function DetailSkeleton() {
  return (
    <section
      className="detail-loading"
      aria-label="Carregando detalhes do NFT"
      data-testid="detail-skeleton"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Carregando detalhes do NFT…
      </p>
      <div className="nft-detail-layout">
        <div className="skeleton detail-gallery-skeleton" aria-hidden="true" />
        <div className="detail-info-skeleton" aria-hidden="true">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      </div>
      <div
        className="skeleton detail-description-skeleton"
        aria-hidden="true"
      />
    </section>
  );
}
