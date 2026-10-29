import { ProfilePanel } from "../account/profile-panel";
import { WalletsPanel } from "../account/wallets";
import { FavoritesPanel } from "../account/favorites-panel";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "@tanstack/react-router";
import { CanceledError } from "axios";
import { logout } from "./service";
import { useAuth } from "./context";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/button";
import type { User } from "./contracts";
export function AccountPage() {
  const auth = useAuth();
  const signout = useMutation({ mutationFn: logout });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search = useSearch({ strict: false }) as {
    accountScenario?: "default" | "slow";
  };
  const scenario = search.accountScenario ?? "default";
  const userId = auth.user?.id;
  const query = useQuery({
    queryKey: ["private", userId, "account", scenario],
    enabled: !!userId && pathname === "/account",
    retry: false,
    queryFn: async ({ signal }) => {
      const user = (
        await api.get<User>("/account", {
          signal,
          params: { accountScenario: scenario },
        })
      ).data;
      if (user.id !== userId)
        throw new CanceledError("Resposta de outra sessão descartada");
      return user;
    },
  });
  if (!auth.user)
    return (
      <section className="page-width private-loading" role="status">
        Verificando sessão…
      </section>
    );
  const wallets = pathname.endsWith("/wallets");
  const profile = pathname.endsWith("/profile");
  const favorites = pathname.endsWith("/favorites");
  return (
    <section className="account-page page-width">
      <aside aria-label="Área da conta">
        <h2>Meu perfil</h2>
        <Link
          to="/account"
          search={{ accountScenario: "default" }}
          activeOptions={{ exact: true }}
        >
          Visão geral
        </Link>
        <Link
          to="/account/profile"
          search={{ accountScenario: "default" }}
          activeOptions={{ exact: true }}
        >
          Perfil do colecionador
        </Link>
        <Link
          to="/account/wallets"
          search={{ accountScenario: "default" }}
          activeOptions={{ exact: true }}
        >
          Carteiras
        </Link>
        <Link
          to="/account/favorites"
          search={{ accountScenario: "default" }}
          activeOptions={{ exact: true }}
        >
          Lista de interesse
        </Link>
        <button
          aria-label="Sair da conta"
          onClick={() => signout.mutate()}
          disabled={signout.isPending}
        >
          Sair
        </button>
        {signout.isError && <p role="alert">Não foi possível sair.</p>}
      </aside>
      <div className="account-content">
        {pathname === "/account" && (
          <p>
            <Link to="/orders" className="text-link">
              Meus pedidos
            </Link>
          </p>
        )}
        <h1>
          {wallets
            ? "Carteiras"
            : favorites
              ? "Lista de interesse"
              : pathname.endsWith("/profile")
                ? "Perfil do colecionador"
                : "Minha conta"}
        </h1>
        {profile ? (
          <ProfilePanel />
        ) : wallets ? (
          <WalletsPanel />
        ) : favorites ? (
          <FavoritesPanel />
        ) : query.isPending ? (
          <div
            role="status"
            className="skeleton account-skeleton"
            aria-label="Carregando dados da conta"
          />
        ) : query.isError ? (
          <div role="alert">
            <p>Não foi possível carregar os dados da conta.</p>
            <Button onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <p className="account-greeting">Olá, {query.data.username}.</p>
            <dl className="account-data">
              <div>
                <dt>Nome de usuário</dt>
                <dd>{query.data.username}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{query.data.email}</dd>
              </div>
            </dl>
            <p className="account-note">
              Gerencie seus dados, carteiras e favoritos pelo menu da conta.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
