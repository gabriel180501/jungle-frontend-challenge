import { RealtimeScenarioTools } from "../../realtime/scenario-tools";
import { SessionTools } from "../auth/session-tools";
import { Link } from "@tanstack/react-router";
import { defaultSearch } from "../catalog/search";
import { detailScenarios } from "../nft-detail/contracts";
import { scenarios } from "../catalog/contracts";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";
import { useDiagnostics } from "../../realtime/use-diagnostics";
import type { Health } from "./contracts";
export function DiagnosticsPage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async ({ signal }) =>
      (await api.get<Health>("/health", { signal })).data,
  });
  const realtime = useDiagnostics();
  return (
    <section className="page-width diagnostics-page space-y-6">
      <div>
        <p className="text-primary text-sm">DIAGNÓSTICO E CENÁRIOS</p>
        <h1 className="mt-3 text-3xl font-semibold">
          Diagnóstico das integrações
        </h1>
        <p className="mt-3 text-muted-foreground">
          Esta área permite verificar as integrações e reproduzir cenários de
          demonstração.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl">API REST simulada</h2>
          <div className="my-5 min-h-12" role="status">
            {health.isPending ? (
              <div
                aria-label="Carregando API"
                className="skeleton h-10 rounded-md"
              />
            ) : health.isError ? (
              <p>Não foi possível consultar a API.</p>
            ) : (
              <p>
                {health.data.service}: <strong>OK</strong>
              </p>
            )}
          </div>
          <Button
            variant="outline"
            disabled={health.isFetching}
            onClick={() => void health.refetch()}
          >
            Consultar API
          </Button>
        </article>
        <article className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl">Socket.IO + MSW</h2>
          <p className="mt-4" role="status">
            {realtime.connected ? "Socket conectado" : "Socket desconectado"}
          </p>
          <p className="my-4 min-h-12 text-muted-foreground" role="status">
            {realtime.message}
          </p>
          <Button
            disabled={!realtime.connected || realtime.pending}
            onClick={realtime.ping}
          >
            {realtime.pending ? "Aguardando evento…" : "Testar evento"}
          </Button>
        </article>
      </div>
      <RealtimeScenarioTools />
      <SessionTools />
      <section className="demo-scenarios">
        <h2>Cenários do catálogo</h2>
        <p>
          Todos usam a mesma API MSW. A falha transitória ocorre uma vez por
          consulta; atualizar a página reinicia o cenário.
        </p>
        <div>
          {scenarios.map((scenario) => (
            <Link
              key={scenario}
              to="/"
              search={{ ...defaultSearch, scenario }}
              hash="catalogo"
            >
              {scenario}
            </Link>
          ))}
        </div>
      </section>
      <section className="demo-scenarios">
        <h2>Cenários do detalhe</h2>
        <div>
          {detailScenarios.map((detailScenario) => (
            <Link
              key={detailScenario}
              to="/nfts/$nftId"
              params={{ nftId: "emerald-ape-042" }}
              search={{ ...defaultSearch, edition: "", detailScenario }}
            >
              {detailScenario}
            </Link>
          ))}
          <Link
            to="/nfts/$nftId"
            params={{ nftId: "nft-035" }}
            search={{
              ...defaultSearch,
              edition: "",
              detailScenario: "default",
            }}
          >
            NFT esgotado
          </Link>
          <Link
            to="/nfts/$nftId"
            params={{ nftId: "inexistente" }}
            search={{
              ...defaultSearch,
              edition: "",
              detailScenario: "default",
            }}
          >
            NFT inexistente
          </Link>
        </div>
      </section>
    </section>
  );
}
