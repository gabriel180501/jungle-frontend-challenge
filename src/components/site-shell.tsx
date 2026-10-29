import { RealtimeNotice } from "../realtime/provider";
import { CartLink } from "../features/cart/badge";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../features/auth/context";
import { logout } from "../features/auth/service";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  Compass,
  Home,
  Search,
  User,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  Bell,
  Menu,
} from "lucide-react";
import { useRef, useState } from "react";
import { defaultSearch } from "../features/catalog/search";
import { Button } from "./ui/button";

export function SiteShell() {
  const auth = useAuth();
  const logoutMutation = useMutation({ mutationFn: logout });
  const currentHref = useLocation({ select: (location) => location.href });
  const pathname = useLocation({ select: (location) => location.pathname });
  const notice = useRef<HTMLDialogElement>(null);
  const [noticeText, setNoticeText] = useState("");
  function unavailable(message: string) {
    setNoticeText(message);
    notice.current?.showModal();
  }
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="site-header page-width">
        <Link
          to="/"
          search={defaultSearch}
          className="wordmark"
          aria-label="Kurio, início"
        >
          KURIO
        </Link>
        <nav aria-label="Principal" className="desktop-navigation">
          <Link
            to="/"
            search={defaultSearch}
            activeOptions={{ exact: true, includeHash: true }}
            activeProps={{ className: "active" }}
          >
            Início
          </Link>
          <Link
            to="/"
            search={defaultSearch}
            hash="catalogo"
            className={pathname.startsWith("/nfts/") ? "active" : undefined}
            activeOptions={{ exact: true, includeHash: true }}
          >
            Mercado
          </Link>
          <button
            onClick={() =>
              unavailable(
                "A página de criadores não faz parte desta demonstração.",
              )
            }
          >
            Criadores
          </button>
          <a href="#diario">Aprenda</a>
        </nav>
        <div className="header-actions">
          <a href="/#catalogo" aria-label="Buscar NFTs">
            <Search size={19} />
          </a>
          <CartLink />
          {auth.loading ? (
            <span className="session-loading" role="status">
              Sessão…
            </span>
          ) : auth.user ? (
            <div className="header-account">
              <Button asChild className="login-button">
                <Link to="/account" search={{ accountScenario: "default" }}>
                  <User size={15} />
                  {auth.user.username}
                </Link>
              </Button>
              <button
                className="logout-button"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? "Saindo…" : "Sair"}
              </button>
            </div>
          ) : (
            <Button asChild className="login-button">
              <Link
                to="/login"
                search={{
                  redirect:
                    currentHref.startsWith("/login") ||
                    currentHref.startsWith("/register")
                      ? "/account"
                      : currentHref,
                  reason: "",
                }}
              >
                <User size={15} /> Entrar
              </Link>
            </Button>
          )}
          <button
            className="mobile-menu"
            aria-label="Informações de navegação"
            onClick={() =>
              unavailable(
                "Explore o catálogo pela busca e pelos filtros. Acesse sua conta pela navegação inferior; acesse o carrinho pelo ícone de sacola.",
              )
            }
          >
            <Menu size={20} />
          </button>
        </div>
      </header>
      {auth.expired &&
        !auth.user &&
        pathname !== "/login" &&
        pathname !== "/register" && (
          <div className="session-banner page-width" role="alert">
            Sua sessão expirou.{" "}
            <Link
              to="/login"
              search={{ redirect: currentHref, reason: "expired" }}
            >
              Entre novamente para continuar.
            </Link>
          </div>
        )}
      {auth.error && (
        <div className="session-banner page-width" role="alert">
          Não foi possível verificar a sessão.{" "}
          <button onClick={auth.refresh}>Tentar novamente</button>
        </div>
      )}
      {logoutMutation.isError && (
        <div className="session-banner page-width" role="alert">
          Não foi possível sair da conta. Tente novamente.
        </div>
      )}
      <RealtimeNotice />
      <main id="conteudo">
        <Outlet />
      </main>
      <footer className="site-footer page-width">
        <div className="footer-benefits">
          <div>
            <ShieldCheck />
            <h2>Segurança da carteira</h2>
            <p>
              Proteja sua carteira e colecione arte digital verificando a
              procedência.
            </p>
          </div>
          <div>
            <Sparkles />
            <h2>Criadores em destaque</h2>
            <p>
              Conheça artistas e comunidades que moldam a cultura digital na
              rede.
            </p>
          </div>
          <div>
            <Bell />
            <h2>Alertas de lançamentos</h2>
            <p>Explore novas coleções e acompanhe seus próximos lançamentos.</p>
          </div>
          <div className="newsletter">
            <h2>Antecipe-se ao próximo lançamento</h2>
            <p>As inscrições para novidades ainda não estão disponíveis.</p>
            <Button variant="outline" disabled>
              Em breve
            </Button>
          </div>
        </div>
        <div className="footer-brand">
          <span className="wordmark">KURIO</span>
          <span>
            Feito para colecionadores,
            <br />
            criadores e cultura
          </span>
          <span>Arte digital. Novas conexões.</span>
        </div>
        <div className="footer-links">
          <div>
            <h2>Meu perfil</h2>
            <Link to="/account" search={{ accountScenario: "default" }}>
              Minha conta
            </Link>
          </div>
          <div>
            <h2>Central de ajuda</h2>
            <button
              onClick={() =>
                unavailable(
                  "Páginas de suporte estão fora do escopo desta demonstração.",
                )
              }
            >
              Carteira e segurança
            </button>
          </div>
          <div>
            <h2>Coleções</h2>
            <Link
              to="/"
              search={{ ...defaultSearch, collections: ["digital-art"] }}
              hash="catalogo"
            >
              Arte digital
            </Link>
            <Link
              to="/"
              search={{ ...defaultSearch, collections: ["photography"] }}
              hash="catalogo"
            >
              Fotografia
            </Link>
            <Link
              to="/"
              search={{ ...defaultSearch, collections: ["music"] }}
              hash="catalogo"
            >
              Música
            </Link>
          </div>
          <div>
            <h2>Carteiras compatíveis</h2>
            <p>
              MetaMask · WalletConnect
              <br />
              Coinbase Wallet
            </p>
          </div>
        </div>
        <p className="copyright">
          © 2026 Kurio. Marketplace de demonstração ·{" "}
          <Link to="/diagnostico">Diagnóstico e cenários</Link>
        </p>
      </footer>
      <nav className="bottom-nav" aria-label="Navegação mobile">
        <Link to="/" search={defaultSearch} aria-label="Início">
          <Home size={19} />
        </Link>
        <Link
          to="/"
          search={defaultSearch}
          hash="catalogo"
          aria-label="Explorar catálogo"
        >
          <Compass size={19} />
        </Link>
        <CartLink mobile />
        <Link
          to="/account"
          search={{ accountScenario: "default" }}
          aria-label="Minha conta"
        >
          <User size={19} />
        </Link>
      </nav>
      <dialog
        ref={notice}
        className="notice-dialog"
        aria-labelledby="notice-title"
      >
        <h2 id="notice-title">Sobre esta demonstração</h2>
        <p>{noticeText}</p>
        <form method="dialog">
          <Button>
            Entendi <ArrowUpRight size={15} />
          </Button>
        </form>
      </dialog>
    </>
  );
}
