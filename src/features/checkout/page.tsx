import { useRealtime } from "../../realtime/use-realtime";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { isAxiosError } from "axios";
import { useAuth } from "../auth/context";
import { profileOptions, walletsOptions } from "../account/api";
import type { Profile, Wallet } from "../account/contracts";
import { Field, SelectField } from "../account/field";
import { Button } from "../../components/ui/button";
import { formatEth } from "../../lib/eth";
import { queryClient } from "../../app/query-client";
import { useCart } from "../cart/api";
import { networks, type Network } from "../catalog/contracts";
import { validateCollector } from "./validation";
import { QuoteComparison } from "./quote-comparison";
import type { Attempt, Collector, PurchaseSnapshot, Review } from "./contracts";
import {
  checkoutError,
  checkoutQuoteOptions,
  connectionOptions,
  connectWallet,
  definitive,
  disconnectWallet,
  findAttempt,
  loadAttempt,
  reviewPurchase,
  saveAttempt,
  sendOrder,
} from "./api";
export function CheckoutPage() {
  const auth = useAuth(),
    profile = useQuery(profileOptions(auth.user?.id)),
    wallets = useQuery(walletsOptions(auth.user?.id));
  useEffect(() => {
    document.title = "Pagamento — Kurio";
    return () => {
      document.title = "Kurio — Arte digital para colecionar";
    };
  }, []);
  if (!auth.user)
    return (
      <p className="page-width" role="status">
        Verificando sessão…
      </p>
    );
  return (
    <section className="checkout-page page-width">
      <nav className="nft-breadcrumbs" aria-label="Caminho da página">
        <Link to="/cart">Carrinho</Link>
        <span>/</span>
        <span>Pagamento</span>
      </nav>
      <div className="checkout-heading">
        <h1>Pagamento com carteira</h1>
        <Link to="/orders" className="text-link">
          Meus pedidos
        </Link>
      </div>
      {(profile.isPending || wallets.isPending) && (
        <p role="status">Carregando dados do colecionador…</p>
      )}
      {(profile.isError || wallets.isError) && (
        <div role="alert">
          <p>Não foi possível carregar perfil e carteiras.</p>
          <Button
            onClick={() => {
              void profile.refetch();
              void wallets.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {profile.data && wallets.data && (
        <CheckoutForm
          key={auth.user.id}
          userId={auth.user.id}
          profile={profile.data}
          wallets={wallets.data.items}
        />
      )}
    </section>
  );
}
function CheckoutForm({
  userId,
  profile,
  wallets,
}: {
  userId: string;
  profile: Profile;
  wallets: Wallet[];
}) {
  const realtime = useRealtime();
  const navigate = useNavigate();
  const cart = useCart(true);
  const [walletId, setWalletId] = useState(
    wallets.find((w) => w.role === "primary")?.id ?? "",
  );
  const selected = wallets.find((w) => w.id === walletId);
  const [network, setNetwork] = useState<Network>(
    selected?.network ?? "Ethereum",
  );
  const [collector, setCollector] = useState<Collector>({
    displayName: profile.displayName,
    username: profile.username,
    profileName: selected?.profileName ?? profile.username,
    referralCode: selected?.referralCode ?? "",
    email: profile.email,
    ens: profile.ens,
    secondaryReference: selected?.secondaryReference ?? "",
    note: "",
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [connectionId, setConnectionId] = useState<string>();
  const connection = useQuery(connectionOptions(userId, connectionId));
  const quote = useQuery({
    ...checkoutQuoteOptions(userId, network),
    enabled: !!cart.data?.items.length,
  });
  const [review, setReview] = useState<Review | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(() =>
    loadAttempt(userId),
  );
  const heldAttempt = useRef(attempt);
  const sending = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    void queryClient.invalidateQueries({
      queryKey: ["private", userId, "checkout-quote"],
    });
  }, [userId, cart.data]);
  const recovery = useQuery({
    queryKey: ["private", userId, "attempt", attempt?.key],
    enabled: !!attempt,
    retry: false,
    queryFn: () => findAttempt(userId, attempt!.key),
  });
  useEffect(() => {
    if (recovery.data) {
      saveAttempt(userId, null);
      void navigate({
        to: "/orders/$orderId",
        params: { orderId: recovery.data.id },
        replace: true,
      });
    }
  }, [recovery.data, userId, navigate]);
  const connect = useMutation({
    mutationFn: () => connectWallet(userId, walletId, network),
    onSuccess: (data) => {
      setConnectionId(data.id);
      queryClient.setQueryData(
        connectionOptions(userId, data.id).queryKey,
        data,
      );
      setReview(null);
      setAccepted(false);
    },
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectWallet(userId, connectionId!),
    onSuccess: () => {
      setConnectionId(undefined);
      setReview(null);
      setAccepted(false);
    },
  });
  const reviewing = useMutation({
    mutationFn: () =>
      reviewPurchase(userId, { collector, connectionId: connectionId! }),
    onSuccess: (data) => {
      setReview(data);
      setAccepted(false);
    },
    onError: (error) => {
      if (isAxiosError(error)) setFields(error.response?.data?.fields ?? {});
    },
  });
  const submit = useMutation({
    retry: false,
    mutationFn: async (next: Attempt) => {
      try {
        return await sendOrder(userId, next);
      } catch (error) {
        if (definitive(error)) throw error;
        const found = await findAttempt(userId, next.key);
        if (found) return found;
        throw error;
      }
    },
    onSuccess: (order) => {
      saveAttempt(userId, null);
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void navigate({
        to: "/orders/$orderId",
        params: { orderId: order.id },
        replace: true,
      });
    },
    onError: (error) => {
      if (definitive(error)) {
        saveAttempt(userId, null);
        setAttempt(null);
        heldAttempt.current = null;
        setReview(null);
        setAccepted(false);
      }
      void quote.refetch();
    },
    onSettled: () => {
      sending.current = false;
    },
  });
  const connected =
    !!connection.data?.connected &&
    !connection.isError &&
    connection.data.walletId === walletId &&
    connection.data.network === network &&
    Date.parse(connection.data.expiresAt) > now;
  const quoteChanged = !!review && !!quote.data &&
    review.snapshot.quote.fingerprint !== quote.data.quote.fingerprint;
  const reviewExpired = !!review && Date.parse(review.expiresAt) <= now;
  const stale = !!review && (!quote.data || quoteChanged || reviewExpired);
  const busy =
    submit.isPending ||
    reviewing.isPending ||
    connect.isPending ||
    disconnect.isPending;
  function update(key: keyof Collector, value: string) {
    setCollector((old) => ({ ...old, [key]: value }));
    setFields((old) => ({ ...old, [key]: "" }));
    setReview(null);
    setAccepted(false);
  }
  function prepare() {
    const errors = validateCollector(collector, network);
    setFields(errors);
    if (Object.keys(errors).length) {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLInputElement>(
            '.checkout-form [aria-invalid="true"]',
          )
          ?.focus(),
      );
      return;
    }
    reviewing.mutate();
  }
  function sendAttempt(next: Attempt) {
    if (sending.current) return;
    sending.current = true;
    submit.mutate(next);
  }
  function confirm() {
    if (
      !review ||
      !accepted ||
      stale ||
      !connected ||
      busy ||
      heldAttempt.current ||
      !realtime.ready
    )
      return;
    const next = { key: crypto.randomUUID(), reviewId: review.id };
    heldAttempt.current = next;
    try {
      saveAttempt(userId, next);
      setAttempt(next);
      sendAttempt(next);
    } catch {
      heldAttempt.current = null;
      setFields({
        form: "Não foi possível guardar a tentativa. Libere espaço antes de enviar.",
      });
    }
  }
  if (attempt)
    return (
      <section className="checkout-recovery">
        <h2>Recuperando tentativa de compra</h2>
        <p>
          A mesma chave será usada para localizar ou retomar o envio, sem criar
          outro pedido.
        </p>
        {(recovery.isFetching || submit.isPending) && (
          <p role="status">Consultando o pedido…</p>
        )}
        {(submit.isError || recovery.isError) && (
          <p role="alert">{checkoutError(submit.error ?? recovery.error)}</p>
        )}
        <Button
          disabled={submit.isPending || recovery.isFetching}
          onClick={() => sendAttempt(attempt)}
        >
          Recuperar tentativa
        </Button>
        <Link to="/orders" className="text-link">
          Ver meus pedidos
        </Link>
      </section>
    );
  if (cart.data && !cart.data.items.length)
    return (
      <section className="cart-empty">
        <h2>Seu carrinho está vazio.</h2>
        <Link to="/orders" className="text-link">
          Ver meus pedidos
        </Link>
        <p>
          <Link to="/cart">Voltar ao carrinho</Link>
        </p>
      </section>
    );
  if (!wallets.length)
    return (
      <div className="checkout-feedback">
        <h2>Cadastre uma carteira para continuar.</h2>
        <p>Use uma carteira principal ou secundária da sua conta.</p>
        <Button asChild>
          <Link to="/account/wallets" search={{ accountScenario: "default" }}>
            Cadastrar carteira
          </Link>
        </Button>
        <p>
          <Link to="/cart">Voltar ao carrinho</Link>
        </p>
      </div>
    );
  return (
    <div className="checkout-layout">
      <div>
        <form
          noValidate
          className="checkout-form"
          aria-label="Perfil do colecionador"
          onSubmit={(event) => {
            event.preventDefault();
            prepare();
          }}
        >
          <h2>Perfil do colecionador</h2>
          <div className="checkout-fields">
            <Field
              label="Nome de exibição"
              value={collector.displayName}
              error={fields.displayName}
              disabled={busy}
              onChange={(e) => update("displayName", e.target.value)}
            />
            <Field
              label="Nome de usuário"
              value={collector.username}
              error={fields.username}
              disabled={busy}
              onChange={(e) => update("username", e.target.value)}
            />
            <SelectField
              label="Carteira cadastrada"
              value={walletId}
              disabled={busy}
              onChange={(e) => {
                const wallet = wallets.find((w) => w.id === e.target.value)!;
                setWalletId(wallet.id);
                setNetwork(wallet.network);
                setConnectionId(undefined);
                setReview(null);
                setAccepted(false);
                setCollector((old) => ({
                  ...old,
                  profileName: wallet.profileName,
                  referralCode: wallet.referralCode,
                  secondaryReference: wallet.secondaryReference,
                }));
              }}
            >
              {wallets.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.role === "primary" ? "Principal" : "Reserva"} —{" "}
                  {w.nickname} · {w.network}
                </option>
              ))}
            </SelectField>
            <Field
              label="Nome do perfil"
              value={collector.profileName}
              error={fields.profileName}
              disabled={busy}
              onChange={(e) => update("profileName", e.target.value)}
            />
            <SelectField
              label="Rede"
              value={network}
              disabled={busy}
              onChange={(e) => {
                setNetwork(e.target.value as Network);
                setConnectionId(undefined);
                setReview(null);
                setAccepted(false);
              }}
            >
              {networks.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </SelectField>
            <Field
              label="Código de indicação"
              value={collector.referralCode}
              error={fields.referralCode}
              disabled={busy}
              onChange={(e) => update("referralCode", e.target.value)}
            />
            <Field
              label="Endereço da carteira"
              value={selected?.address ?? ""}
              readOnly
            />
            <Field
              label="ENS ou carteira secundária (opcional)"
              value={collector.secondaryReference}
              error={fields.secondaryReference}
              disabled={busy}
              onChange={(e) => update("secondaryReference", e.target.value)}
            />
            <Field
              label="Tipo de carteira"
              value={selected?.walletType ?? ""}
              readOnly
            />
            <Field
              label="Nome ENS (opcional)"
              value={collector.ens}
              error={fields.ens}
              disabled={busy}
              onChange={(e) => update("ens", e.target.value)}
            />
            <Field
              label="E-mail"
              type="email"
              value={collector.email}
              error={fields.email}
              disabled={busy}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
          <label className="checkout-note">
            Observação do colecionador (opcional)
            <textarea
              maxLength={500}
              value={collector.note}
              disabled={busy}
              onChange={(e) => update("note", e.target.value)}
              aria-invalid={!!fields.note}
            />
          </label>
          {fields.note && <p className="field-error">{fields.note}</p>}
          <p>
            <Link
              to="/account/wallets"
              search={{ accountScenario: "default" }}
              className="text-link"
            >
              Gerenciar carteiras
            </Link>
          </p>
          <section className="wallet-connection">
            <h2>Carteira e rede</h2>
            <p>
              {selected?.walletType} · {network}
            </p>
            {selected?.network !== network && (
              <p role="alert">
                A rede deve corresponder à carteira cadastrada. Selecione outra
                carteira ou ajuste a rede.
              </p>
            )}
            {connected ? (
              <>
                <p role="status">Carteira conectada (simulação).</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => disconnect.mutate()}
                >
                  Desconectar carteira
                </Button>
              </>
            ) : (
              <>
                <p role="status">
                  {connectionId
                    ? "A carteira foi desconectada ou expirou."
                    : "Nenhuma carteira conectada."}
                </p>
                <Button
                  type="button"
                  disabled={busy || selected?.network !== network}
                  onClick={() => connect.mutate()}
                >
                  {connect.isPending
                    ? "Conectando…"
                    : "Conectar carteira simulada"}
                </Button>
              </>
            )}
            {(connect.isError || disconnect.isError || connection.isError) && (
              <p role="alert">
                {checkoutError(
                  connect.error ?? disconnect.error ?? connection.error,
                )}
              </p>
            )}
          </section>
          {fields.form && <p role="alert">{fields.form}</p>}
          {Object.values(fields).some(Boolean) && (
            <p className="field-error" role="alert">
              Confira os campos destacados.
            </p>
          )}
          {reviewing.isError && (
            <p role="alert">{checkoutError(reviewing.error)}</p>
          )}
          {submit.isError && <p role="alert">{checkoutError(submit.error)}</p>}
          <Button
            type="submit"
            disabled={
              !connected ||
              busy ||
              !quote.data?.quote.valid ||
              quote.isError ||
              cart.isError
            }
          >
            {reviewing.isPending ? "Revisando…" : "Revisar compra"}
          </Button>
        </form>
        {review && (
          <section className="checkout-review" aria-labelledby="review-title">
            <h2 id="review-title">Revise antes de confirmar</h2>
            <p>
              {review.snapshot.collector.displayName} ·{" "}
              {review.snapshot.collector.email}
            </p>
            <p>
              {review.snapshot.wallet.nickname} · {review.snapshot.network}
            </p>
            <p className="checkout-address">{review.snapshot.wallet.address}</p>
            <p>
              Total revisado:{" "}
              <strong>{formatEth(review.snapshot.quote.total)} ETH</strong>
            </p>
            {quoteChanged && (
              <p role="alert">
                A cotação mudou. Confira as alterações e clique em Revisar compra novamente.
              </p>
            )}
            {reviewExpired && (
              <p role="alert">
                {quote.data && !quoteChanged && !quote.isError && !quote.isFetching
                  ? "A revisão expirou, mas os valores não mudaram. Clique em Revisar compra novamente."
                  : "A revisão expirou. Clique em Revisar compra novamente."}
              </p>
            )}
            {quoteChanged && quote.data && !quote.isError && !quote.isFetching && (
              <QuoteComparison previous={review.snapshot} current={quote.data} />
            )}
            {!connected && (
              <p role="alert">
                Conecte a carteira novamente e revise a compra.
              </p>
            )}
            <label className="cart-review">
              <input
                type="checkbox"
                checked={accepted}
                disabled={busy || stale || !connected}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              Conferi os dados, itens e valores desta compra simulada
            </label>
            <Button
              disabled={
                !accepted ||
                !realtime.ready ||
                stale ||
                !connected ||
                busy ||
                quote.isError ||
                cart.isError ||
                quote.isFetching
              }
              onClick={confirm}
            >
              Confirmar compra simulada
            </Button>
          </section>
        )}
      </div>
      <aside className="checkout-summary">
        <h2>Seus NFTs nesta rede</h2>
        {quote.isPending && <p role="status">Calculando cotação…</p>}
        {(quote.isError || cart.isError) && (
          <div role="alert">
            <p>Não foi possível atualizar a cotação.</p>
            <Button
              onClick={() => {
                void quote.refetch();
                void cart.refetch();
              }}
            >
              Recalcular cotação
            </Button>
          </div>
        )}
        {quote.data && (
          <>
            <SnapshotSummary snapshot={quote.data} />
            {!!quote.data.otherItems && (
              <p className="checkout-feedback">
                {quote.data.otherItems} unidade(s) de outras redes permanecerão
                no carrinho.
              </p>
            )}
            {quote.data.quote.problems.map((problem) => (
              <p className="field-error" role="alert" key={problem}>
                {problem}
              </p>
            ))}
            {!quote.data.items.length && (
              <p role="status">Não há NFTs desta rede no carrinho.</p>
            )}
          </>
        )}
        <Link to="/cart" className="text-link">
          Editar itens ou cupom no carrinho
        </Link>
        <p className="checkout-simulation">
          Demonstração: conexão, transação e transferência simuladas, sem
          extensão de carteira ou cobrança real.
        </p>
      </aside>
    </div>
  );
}
export function SnapshotSummary({
  snapshot,
}: {
  snapshot: Pick<PurchaseSnapshot, "items" | "quote">;
}) {
  return (
    <>
      <div className="checkout-nfts">
        {snapshot.items.map((item) => (
          <article key={item.id}>
            <img src={item.image} alt={item.name} />
            <div>
              <h3>
                {item.name} (× {item.quantity})
              </h3>
              <p>
                ID do token: {item.tokenId} · {item.edition}
              </p>
            </div>
            <strong>{formatEth(item.total)} ETH</strong>
          </article>
        ))}
      </div>
      <dl className="cart-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatEth(snapshot.quote.subtotal)} ETH</dd>
        </div>
        <div>
          <dt>Desconto</dt>
          <dd>− {formatEth(snapshot.quote.discount)} ETH</dd>
        </div>
        <div>
          <dt>Taxa de rede</dt>
          <dd>{formatEth(snapshot.quote.networkFee)} ETH</dd>
        </div>
        <div className="cart-grand-total">
          <dt>Total</dt>
          <dd data-testid="checkout-total">
            {formatEth(snapshot.quote.total)} ETH
          </dd>
        </div>
      </dl>
    </>
  );
}
