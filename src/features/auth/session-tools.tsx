import { CheckoutScenarioTools } from "../checkout/scenario-tools";
import { CartScenarioTools } from "../cart/scenario-tools";
import { useState } from "react";
import { api } from "../../lib/api";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "./context";
import { expireDemoSession, resetDemo } from "./service";
import { Button } from "../../components/ui/button";
export function SessionTools() {
  const auth = useAuth();
  const [favoriteScenario, setFavoriteScenario] = useState("default");
  const favorite = useMutation({
    mutationFn: () =>
      api.post("/demo/favorites/scenario", { mode: favoriteScenario }),
  });
  const expire = useMutation({ mutationFn: expireDemoSession });
  const reset = useMutation({ mutationFn: resetDemo });
  return (
    <>
      <section className="demo-scenarios session-tools">
        <h2>Sessão e reset</h2>
        <p>
          {auth.user
            ? `Conta atual: ${auth.user.email}`
            : "Nenhuma conta conectada."}
        </p>
        <div>
          <Button
            variant="outline"
            disabled={!auth.user || expire.isPending}
            onClick={() => expire.mutate()}
          >
            Expirar sessão
          </Button>
          <Button
            variant="outline"
            disabled={reset.isPending}
            onClick={() => reset.mutate()}
          >
            Restaurar cenário inicial
          </Button>
        </div>
        <div className="favorite-scenarios">
          <label>
            Cenário de favoritos
            <select
              value={favoriteScenario}
              onChange={(event) => setFavoriteScenario(event.target.value)}
              disabled={!auth.user}
            >
              <option value="default">Padrão</option>
              <option value="slow">Resposta lenta</option>
              <option value="fail-once">Falhar uma vez</option>
            </select>
          </label>
          <Button
            disabled={!auth.user || favorite.isPending}
            onClick={() => favorite.mutate()}
          >
            Aplicar cenário de favoritos
          </Button>
        </div>
        {favorite.isSuccess && (
          <p role="status">Cenário de favoritos aplicado.</p>
        )}
        {(expire.isError || reset.isError || favorite.isError) && (
          <p role="alert">
            Não foi possível alterar o cenário. Tente novamente.
          </p>
        )}
        {reset.isSuccess && <p role="status">Cenário inicial restaurado.</p>}
      </section>
      <CartScenarioTools />
      <CheckoutScenarioTools />
    </>
  );
}
