import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../auth/context";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { checkoutError } from "./api";
export function CheckoutScenarioTools() {
  const auth = useAuth();
  const [wallet, setWallet] = useState("connect"),
    [order, setOrder] = useState("confirm"),
    [fee, setFee] = useState("0.016"),
    [expired, setExpired] = useState(false),
    [orderId, setOrderId] = useState("");
  const scenario = useMutation({
    mutationFn: () => api.post("/demo/orders/scenario", { wallet, order }),
  });
  const pricing = useMutation({
    mutationFn: () =>
      api.post("/demo/pricing", { networkFee: fee, couponExpired: expired }),
  });
  const resolve = useMutation({
    mutationFn: (status: "confirmed" | "rejected") =>
      api.post(`/demo/orders/${encodeURIComponent(orderId)}/resolve`, {
        status,
      }),
  });
  return (
    <section className="demo-scenarios cart-scenarios">
      <h2>Pagamento e pedidos</h2>
      <p>
        Somente simulação. O cenário Pendente aguarda resolução manual abaixo;
        os demais concluem após a consulta do estado.
      </p>
      <label>
        Conexão de carteira
        <select value={wallet} onChange={(e) => setWallet(e.target.value)}>
          <option value="connect">Conectar</option>
          <option value="refuse">Recusar conexão</option>
          <option value="disconnect">Desconectar após conectar</option>
        </select>
      </label>
      <label>
        Resultado do pedido
        <select value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="confirm">Confirmar</option>
          <option value="reject">Recusar</option>
          <option value="pending">Manter pendente</option>
          <option value="timeout-confirm">Timeout após aceitar</option>
          <option value="fail-once">Falhar antes de aceitar uma vez</option>
          <option value="offline">Falhar consulta e envio</option>
        </select>
      </label>
      <Button
        disabled={!auth.user || scenario.isPending}
        onClick={() => scenario.mutate()}
      >
        Aplicar cenário de pagamento
      </Button>
      <label>
        Taxa por rede em ETH
        <input value={fee} onChange={(e) => setFee(e.target.value)} />
      </label>
      <label className="cart-review">
        <input
          type="checkbox"
          checked={expired}
          onChange={(e) => setExpired(e.target.checked)}
        />
        Expirar cupom KURIO10
      </label>
      <Button disabled={pricing.isPending} onClick={() => pricing.mutate()}>
        Atualizar taxa e validade do cupom
      </Button>
      <label>
        ID do pedido pendente
        <input value={orderId} onChange={(e) => setOrderId(e.target.value)} />
      </label>
      <div>
        <Button
          disabled={!auth.user || !orderId || resolve.isPending}
          onClick={() => resolve.mutate("confirmed")}
        >
          Confirmar pedido pendente
        </Button>
        <Button
          variant="outline"
          disabled={!auth.user || !orderId || resolve.isPending}
          onClick={() => resolve.mutate("rejected")}
        >
          Recusar pedido pendente
        </Button>
      </div>
      {(scenario.isSuccess || pricing.isSuccess || resolve.isSuccess) && (
        <p role="status">Cenário de pagamento atualizado.</p>
      )}
      {(scenario.isError || pricing.isError || resolve.isError) && (
        <p role="alert">
          {checkoutError(scenario.error ?? pricing.error ?? resolve.error)}
        </p>
      )}
    </section>
  );
}
