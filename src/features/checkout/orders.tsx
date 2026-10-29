import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { isAxiosError } from "axios";
import { useAuth } from "../auth/context";
import { Button } from "../../components/ui/button";
import { queryClient } from "../../app/query-client";
import { checkoutError, listOrdersOptions, orderOptions } from "./api";
import { SnapshotSummary } from "./page";
const statusName = {
  pending: "Pendente",
  confirmed: "Confirmado",
  rejected: "Recusado",
};
export function OrdersPage() {
  const auth = useAuth();
  const query = useQuery({
    ...listOrdersOptions(auth.user?.id ?? ""),
    enabled: !!auth.user,
  });
  return (
    <section className="orders-page page-width">
      <div className="checkout-heading">
        <h1>Meus pedidos</h1>
        <Link to="/cart" className="text-link">
          Voltar ao carrinho
        </Link>
      </div>
      {query.isPending && <p role="status">Consultando pedidos…</p>}
      {query.isError && (
        <div role="alert">
          <p>{checkoutError(query.error)}</p>
          <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
        </div>
      )}
      {query.data?.items.length === 0 && <p>Você ainda não tem pedidos.</p>}
      <div className="orders-list">
        {query.data?.items.map((order) => (
          <article key={order.id}>
            <p>
              {statusName[order.status]} ·{" "}
              {new Date(order.createdAt).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </p>
            <h2>Pedido {order.id.slice(0, 8)}</h2>
            <p>
              {order.snapshot.items.length} item(ns) · {order.snapshot.network}
            </p>
            <Link
              to="/orders/$orderId"
              params={{ orderId: order.id }}
              className="text-link"
            >
              Ver pedido {order.id.slice(0, 8)}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
export function OrderPage() {
  const auth = useAuth();
  const { orderId } = useParams({ strict: false }) as { orderId: string };
  const query = useQuery({
    ...orderOptions(auth.user?.id ?? "", orderId),
    enabled: !!auth.user,
  });
  const explorer = useRef<HTMLDialogElement>(null);
  const order = query.data;
  useEffect(() => {
    if (order && order.status !== "pending") {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["nfts"] });
    }
  }, [order]);
  useEffect(() => {
    document.title = order
      ? `${statusName[order.status]} — Pedido Kurio`
      : "Pedido — Kurio";
    return () => {
      document.title = "Kurio — Arte digital para colecionar";
    };
  }, [order]);
  const denied =
    isAxiosError(query.error) &&
    [403, 404].includes(query.error.response?.status ?? 0);
  return (
    <section className="order-page page-width">
      <nav className="nft-breadcrumbs" aria-label="Caminho da página">
        <Link to="/orders">Meus pedidos</Link>
        <span>/</span>
        <span>Detalhes do pedido</span>
      </nav>
      {query.isPending && <p role="status">Consultando pedido…</p>}
      {query.isError && (
        <div role="alert">
          <h1>
            {denied
              ? "Pedido indisponível"
              : "Não foi possível consultar o pedido"}
          </h1>
          <p>{checkoutError(query.error)}</p>
          {!denied && (
            <Button onClick={() => void query.refetch()}>
              Consultar novamente
            </Button>
          )}
        </div>
      )}
      {order && (
        <>
          <h1>
            {order.status === "confirmed"
              ? "Compra confirmada"
              : order.status === "rejected"
                ? "Compra recusada"
                : "Pedido em processamento"}
          </h1>
          <p className="order-state" role="status">
            Estado: {statusName[order.status]}
          </p>
          {order.status === "pending" && (
            <div className="checkout-feedback">
              <p>
                O envio foi recebido e ainda está pendente. Aguarde ou consulte
                novamente. Atualizar esta página mantém o mesmo pedido.
              </p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                Consultar estado
              </Button>
            </div>
          )}
          {order.status === "rejected" && (
            <p role="alert" className="checkout-feedback">
              {order.reason}
            </p>
          )}
          {order.status === "confirmed" && (
            <h2>Seus NFTs agora estão na sua carteira (simulação)</h2>
          )}
          <div className="receipt-layout">
            <div className="receipt-details">
              <h2>Detalhes da transação</h2>
              <dl>
                <dt>Pedido</dt>
                <dd>{order.id}</dd>
                <dt>Data</dt>
                <dd>
                  {new Date(order.createdAt).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </dd>
                <dt>Colecionador</dt>
                <dd>{order.snapshot.collector.displayName}</dd>
                <dt>E-mail</dt>
                <dd>{order.snapshot.collector.email}</dd>
                <dt>Carteira</dt>
                <dd>
                  {order.snapshot.wallet.walletType} ·{" "}
                  {order.snapshot.wallet.nickname}
                </dd>
                <dt>Endereço</dt>
                <dd>{order.snapshot.wallet.address}</dd>
                <dt>Rede</dt>
                <dd>{order.snapshot.network}</dd>
                {order.transaction && (
                  <>
                    <dt>Referência simulada</dt>
                    <dd>{order.transaction}</dd>
                  </>
                )}
                {order.snapshot.collector.note && (
                  <>
                    <dt>Observação</dt>
                    <dd>{order.snapshot.collector.note}</dd>
                  </>
                )}
              </dl>
              {order.status === "confirmed" && (
                <Button
                  variant="outline"
                  onClick={() => explorer.current?.showModal()}
                >
                  Ver referência simulada
                </Button>
              )}
            </div>
            <aside className="checkout-summary">
              <h2>
                {order.status === "confirmed"
                  ? "Recibo da compra"
                  : "Resumo do pedido"}
              </h2>
              <SnapshotSummary snapshot={order.snapshot} />
              <p className="checkout-simulation">
                Valores registrados no envio do pedido. Nenhuma transação real
                foi realizada.
              </p>
            </aside>
          </div>
          <div className="order-actions">
            <Button asChild>
              <Link to="/cart">Voltar ao carrinho</Link>
            </Button>
            <Link to="/orders" className="text-link">
              Ver todos os pedidos
            </Link>
          </div>
          <dialog
            ref={explorer}
            className="notice-dialog"
            aria-labelledby="simulated-explorer"
          >
            <h2 id="simulated-explorer">Explorador simulado</h2>
            <p>
              Esta referência é demonstrativa e não corresponde a uma transação
              em blockchain.
            </p>
            <p className="checkout-address">{order.transaction}</p>
            <p>Rede: {order.snapshot.network}</p>
            <form method="dialog">
              <Button>Fechar</Button>
            </form>
          </dialog>
        </>
      )}
    </section>
  );
}
