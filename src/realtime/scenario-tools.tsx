import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { useRealtime } from "./use-realtime";
export function RealtimeScenarioTools() {
  const realtime = useRealtime();
  const [type, setType] = useState("nft.updated");
  const mutation = useMutation({
    mutationFn: (action: string) =>
      api.post("/demo/realtime/control", { action, type }),
  });
  const stats = useQuery({
    queryKey: ["realtime-stats"],
    queryFn: async () =>
      (
        await api.get<{ connections: number; subscriptions: number }>(
          "/demo/realtime/stats",
        )
      ).data,
    refetchInterval: 2000,
  });
  return (
    <section className="demo-scenarios cart-scenarios">
      <h2>Eventos de negócio e reconexão</h2>
      <p>
        Conexão de negócio:{" "}
        <strong data-testid="rt-status">{realtime.status}</strong>
      </p>
      <p>
        Eventos aceitos:{" "}
        <span data-testid="rt-accepted">{realtime.accepted}</span> · Ignorados:{" "}
        <span data-testid="rt-ignored">{realtime.ignored}</span> ·
        Reconciliações:{" "}
        <span data-testid="rt-reconciliations">{realtime.reconciliations}</span>
      </p>
      <p>
        Conexões locais:{" "}
        <span data-testid="rt-connections">
          {stats.data?.connections ?? "…"}
        </span>{" "}
        · Subscriptions:{" "}
        <span data-testid="rt-subscriptions">
          {stats.data?.subscriptions ?? "…"}
        </span>
      </p>
      <div>
        <Button
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("interrupt")}
        >
          Interromper tempo real
        </Button>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("resume")}
        >
          Retomar tempo real
        </Button>
      </div>
      <label>
        Evento para repetir
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option>nft.updated</option>
          <option>order.updated</option>
          <option>pricing.updated</option>
        </select>
      </label>
      <div>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("duplicate")}
        >
          Repetir evento duplicado
        </Button>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("stale")}
        >
          Enviar evento antigo
        </Button>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("drop-next")}
        >
          Perder próximo evento
        </Button>
      </div>
      <div>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("foreign")}
        >
          Testar evento de outra conta
        </Button>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("old-session")}
        >
          Testar subscription anterior
        </Button>
      </div>
      <p>
        Mude preço/estoque nos controles do carrinho ou resolva um pedido
        pendente abaixo. Os avisos passam pelo socket.io-client. A retomada
        consulta a API para recuperar mensagens perdidas.
      </p>
      {mutation.isSuccess && (
        <p role="status">Cenário de tempo real aplicado.</p>
      )}
      {mutation.isError && (
        <p role="alert">
          Não foi possível executar o cenário. Para repetir, gere primeiro um
          evento desse tipo.
        </p>
      )}
    </section>
  );
}
