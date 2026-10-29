import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../auth/context";
import {
  cartError,
  useCart,
  useCartBusy,
  useCartMutation,
  useQuote,
} from "./api";
import type { CartItem } from "./contracts";
import { formatEth } from "../../lib/eth";
import { Button } from "../../components/ui/button";
import { defaultSearch } from "../catalog/search";
import { catalogOptions } from "../catalog/api";
import { NftCard } from "../catalog/nft-card";
export function CartPage() {
  const auth = useAuth(),
    navigate = useNavigate();
  const cart = useCart(true),
    quote = useQuote(cart.data),
    mutation = useCartMutation(),
    busy = useCartBusy();
  const [coupon, setCoupon] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [reviewed, setReviewed] = useState("");
  const previous = useRef("");
  const [marketChanged, setMarketChanged] = useState(false);
  const recommendations = useQuery(
    catalogOptions({ ...defaultSearch, sort: "recent" }),
  );
  const fingerprint = quote.data?.fingerprint ?? "";
  useEffect(() => {
    document.title = "Carrinho de NFTs — Kurio";
    return () => {
      document.title = "Kurio — Arte digital para colecionar";
    };
  }, []);
  useEffect(() => {
    if (!fingerprint) return;
    if (previous.current && previous.current !== fingerprint)
      setMarketChanged(true);
    previous.current = fingerprint;
  }, [fingerprint]);
  const canContinue =
    !!cart.data?.items.length &&
    !!quote.data?.valid &&
    Date.parse(quote.data.expiresAt) > now &&
    quote.data.cartVersion === cart.data.version &&
    !cart.isError &&
    !quote.isError &&
    !busy &&
    !cart.isFetching &&
    !quote.isFetching &&
    (!marketChanged || reviewed === fingerprint);
  function next() {
    if (!canContinue) return;
    if (!auth.user)
      void navigate({
        to: "/login",
        search: { redirect: "/cart", reason: "" },
      });
    else void navigate({ to: "/checkout" });
  }
  return (
    <div className="cart-page page-width">
      <nav className="nft-breadcrumbs" aria-label="Caminho da página">
        <Link to="/" search={defaultSearch}>
          Início
        </Link>
        <span>/</span>
        <Link to="/" search={defaultSearch} hash="catalogo">
          Mercado
        </Link>
        <span>/</span>
        <span aria-current="page">Carrinho</span>
      </nav>
      <h1>Carrinho de NFTs</h1>
      {(cart.isPending || auth.loading) && (
        <p role="status">Carregando carrinho…</p>
      )}
      {cart.isError && (
        <div role="alert" className="cart-feedback">
          <p>Não foi possível atualizar o carrinho.</p>
          <Button onClick={() => void cart.refetch()}>Tentar novamente</Button>
        </div>
      )}
      {cart.data?.notices.map((notice) => (
        <p key={notice} role="status" className="cart-feedback">
          {notice}
        </p>
      ))}
      {mutation.isError && (
        <p className="cart-feedback" role="alert">
          {cartError(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p className="sr-only" role="status">
          Carrinho atualizado.
        </p>
      )}
      {cart.data && cart.data.items.length === 0 ? (
        <section className="cart-empty">
          <h2>Seu carrinho está vazio.</h2>
          <p>Escolha uma peça para começar sua coleção.</p>
          <Button asChild>
            <Link to="/" search={defaultSearch} hash="catalogo">
              Explorar NFTs
            </Link>
          </Button>
        </section>
      ) : (
        cart.data && (
          <div className="cart-layout">
            <section aria-label="Itens do carrinho" className="cart-items">
              <div className="cart-column-head" aria-hidden="true">
                <span>NFTs</span>
                <span>Preço</span>
                <span>Quantidade</span>
                <span>Total</span>
              </div>
              {cart.data.items.map((item) => (
                <CartRow
                  key={item.id}
                  item={item}
                  disabled={busy || cart.isFetching}
                  change={(quantity) =>
                    mutation.mutate({
                      kind: "quantity",
                      item: {
                        nftId: item.nftId,
                        editionId: item.editionId,
                        quantity,
                      },
                    })
                  }
                  remove={() => mutation.mutate({ kind: "remove", item })}
                />
              ))}
            </section>
            <aside
              className="cart-summary"
              aria-labelledby="cart-summary-title"
            >
              <h2 id="cart-summary-title">Resumo da carteira</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!busy) mutation.mutate({ kind: "coupon", coupon });
                }}
              >
                <label htmlFor="cart-coupon">Código promocional</label>
                <div className="coupon-entry">
                  <input
                    id="cart-coupon"
                    value={coupon}
                    maxLength={40}
                    placeholder="Digite o código promocional…"
                    onChange={(event) => setCoupon(event.target.value)}
                    disabled={busy}
                  />
                  <Button type="submit" disabled={busy || !coupon.trim()}>
                    Aplicar
                  </Button>
                </div>
              </form>
              {cart.data.coupon && (
                <p className="applied-coupon">
                  Cupom {cart.data.coupon}
                  <button
                    disabled={busy}
                    onClick={() =>
                      mutation.mutate({ kind: "coupon", coupon: "" })
                    }
                  >
                    Remover cupom
                  </button>
                </p>
              )}
              {quote.isPending && <p role="status">Calculando cotação…</p>}
              {quote.isError && (
                <div role="alert">
                  <p>Não foi possível atualizar a cotação.</p>
                  <Button onClick={() => void quote.refetch()}>
                    Recalcular cotação
                  </Button>
                </div>
              )}
              {quote.data && (
                <>
                  <dl className="cart-totals" aria-label="Cotação da API">
                    <div>
                      <dt>Subtotal</dt>
                      <dd data-testid="cart-subtotal">
                        {formatEth(quote.data.subtotal)} ETH
                      </dd>
                    </div>
                    <div>
                      <dt>Desconto do lançamento</dt>
                      <dd data-testid="cart-discount">
                        − {formatEth(quote.data.discount)} ETH
                      </dd>
                    </div>
                    <div>
                      <dt>Taxa de rede</dt>
                      <dd data-testid="cart-fee">
                        {formatEth(quote.data.networkFee)} ETH
                      </dd>
                    </div>
                    <div className="cart-grand-total">
                      <dt>Total</dt>
                      <dd data-testid="cart-total">
                        {formatEth(quote.data.total)} ETH
                      </dd>
                    </div>
                  </dl>
                  <p className="cart-fee-note">
                    Taxa estimada por rede. A cotação será revalidada no
                    pagamento.
                  </p>
                  {quote.data.problems.map((problem) => (
                    <p key={problem} role="alert" className="field-error">
                      {problem}
                    </p>
                  ))}
                  {marketChanged && (
                    <div className="cart-feedback" role="status">
                      <p>
                        O carrinho ou a cotação mudou. Confira os itens e
                        valores antes de continuar.
                      </p>
                      <label className="cart-review">
                        <input
                          type="checkbox"
                          checked={reviewed === fingerprint}
                          onChange={(event) =>
                            setReviewed(event.target.checked ? fingerprint : "")
                          }
                        />
                        Conferi os itens e valores atualizados
                      </label>
                    </div>
                  )}
                </>
              )}
              <Button
                className="cart-checkout"
                disabled={!canContinue}
                onClick={next}
              >
                {auth.user ? "Continuar para pagamento" : "Entrar e continuar"}
              </Button>
              <Link
                className="cart-continue text-link"
                to="/"
                search={defaultSearch}
                hash="catalogo"
              >
                Continuar explorando
              </Link>
              <p className="cart-stage-note">
                Conexão e pagamento são simulados, sem cobrança real.
              </p>
            </aside>
          </div>
        )
      )}
      {!!recommendations.data?.items.length && (
        <section className="related-nfts">
          <h2>Colecionadores também viram</h2>
          <div className="related-grid">
            {recommendations.data.items.slice(0, 5).map((nft) => (
              <NftCard key={nft.id} nft={nft} search={defaultSearch} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
function CartRow({
  item,
  disabled,
  change,
  remove,
}: {
  item: CartItem;
  disabled: boolean;
  change: (quantity: number) => void;
  remove: () => void;
}) {
  const [draft, setDraft] = useState(String(item.quantity));
  const [error, setError] = useState("");
  const [lastQuantity, setLastQuantity] = useState(item.quantity);
  if (lastQuantity !== item.quantity) {
    setLastQuantity(item.quantity);
    setDraft(String(item.quantity));
    setError("");
  }
  function apply() {
    const quantity = Number(draft);
    if (
      !/^\d+$/.test(draft) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > item.limit
    ) {
      setError(`Escolha uma quantidade inteira entre 1 e ${item.limit || 1}.`);
      return;
    }
    setError("");
    if (quantity !== item.quantity) change(quantity);
  }
  return (
    <article
      className="cart-row"
      data-testid={`cart-row-${item.id}`}
      aria-label={`${item.name}, edição ${item.edition}`}
    >
      <Link
        className="cart-art"
        to="/nfts/$nftId"
        params={{ nftId: item.nftId }}
        search={{
          ...defaultSearch,
          edition: item.editionId,
          detailScenario: "default",
        }}
      >
        <img src={item.image} alt={item.name} />
      </Link>
      <div className="cart-item-name">
        <h2>
          <Link
            to="/nfts/$nftId"
            params={{ nftId: item.nftId }}
            search={{
              ...defaultSearch,
              edition: item.editionId,
              detailScenario: "default",
            }}
          >
            {item.name}
          </Link>
        </h2>
        <p>ID do token: {item.tokenId}</p>
        <p>
          Edição: {item.edition} · {item.network}
        </p>
      </div>
      <p className="cart-unit-price">
        <span className="sr-only">Preço unitário: </span>
        {formatEth(item.unitPrice)} ETH
      </p>
      <form
        noValidate
        className="cart-quantity"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <div className="quantity-stepper">
          <button
            type="button"
            aria-label={`Diminuir quantidade de ${item.name} ${item.edition}`}
            disabled={disabled || item.quantity <= 1}
            onClick={() => change(item.quantity - 1)}
          >
            <Minus size={14} />
          </button>
          <input
            aria-label={`Quantidade de ${item.name} ${item.edition}`}
            type="number"
            min="1"
            max={item.limit || 1}
            step="1"
            value={draft}
            disabled={disabled || item.limit === 0}
            aria-invalid={!!error}
            aria-describedby={error ? `error-${item.id}` : undefined}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={apply}
          />
          <button
            type="button"
            aria-label={`Aumentar quantidade de ${item.name} ${item.edition}`}
            disabled={disabled || item.quantity >= item.limit}
            onClick={() => change(item.quantity + 1)}
          >
            <Plus size={14} />
          </button>
        </div>
      </form>
      <strong className="cart-line-total">{formatEth(item.total)} ETH</strong>
      <button
        className="cart-remove"
        aria-label={`Remover ${item.name} ${item.edition}`}
        disabled={disabled}
        onClick={remove}
      >
        <Trash2 size={18} />
      </button>
      {(error || item.problem) && (
        <p
          className="cart-line-error field-error"
          id={`error-${item.id}`}
          role="alert"
        >
          {error || item.problem}
        </p>
      )}
    </article>
  );
}
