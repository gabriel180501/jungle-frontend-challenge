import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { cartError } from "./api";
export function CartScenarioTools() {
  const [mode, setMode] = useState("default");
  const [nftId, setNftId] = useState("emerald-ape-042");
  const [editionId, setEditionId] = useState("limited-50");
  const [price, setPrice] = useState("1.5");
  const [available, setAvailable] = useState("2");
  const scenario = useMutation({
    mutationFn: () => api.post("/demo/cart/scenario", { mode }),
  });
  const market = useMutation({
    mutationFn: () =>
      api.post("/demo/market", {
        nftId,
        editionId,
        price,
        available: Number(available),
      }),
  });
  return (
    <section className="demo-scenarios cart-scenarios">
      <h2>Carrinho e cotação</h2>
      <p>
        Cupom válido: KURIO10 (10%). Use EXPIRADO para testar expiração.
        Mudanças abaixo afetam o catálogo e os carrinhos desta simulação.
      </p>
      <label>
        Cenário do carrinho
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="default">Padrão</option>
          <option value="slow">Resposta lenta</option>
          <option value="fail-once">Próxima alteração falha</option>
          <option value="offline">Sem conexão</option>
        </select>
      </label>
      <Button disabled={scenario.isPending} onClick={() => scenario.mutate()}>
        Aplicar cenário do carrinho
      </Button>
      <label>
        NFT a atualizar
        <input value={nftId} onChange={(e) => setNftId(e.target.value)} />
      </label>
      <label>
        Edição a atualizar
        <select
          value={editionId}
          onChange={(e) => setEditionId(e.target.value)}
        >
          <option value="unique">1/1</option>
          <option value="limited-10">1/10</option>
          <option value="limited-50">1/50</option>
          <option value="open">ABERTA</option>
        </select>
      </label>
      <label>
        Novo preço em ETH
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
        />
      </label>
      <label>
        Novo estoque
        <input
          type="number"
          min="0"
          max="99"
          step="1"
          value={available}
          onChange={(e) => setAvailable(e.target.value)}
        />
      </label>
      <Button disabled={market.isPending} onClick={() => market.mutate()}>
        Atualizar preço e estoque
      </Button>
      {(scenario.isSuccess || market.isSuccess) && (
        <p role="status">Cenário do carrinho atualizado.</p>
      )}
      {(scenario.isError || market.isError) && (
        <p role="alert">{cartError(scenario.error ?? market.error)}</p>
      )}
    </section>
  );
}
