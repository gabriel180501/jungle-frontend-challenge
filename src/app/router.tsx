import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { parseAuthSearch, parseAccountSearch } from "../features/auth/search";
import { requireSession } from "../features/auth/guards";
import { SiteShell } from "../components/site-shell";
import { CatalogPage } from "../features/catalog/page";
import { parseDetailSearch } from "../features/nft-detail/search";
import { defaultSearch, parseCatalogSearch } from "../features/catalog/search";
const rootRoute = createRootRoute({
  component: SiteShell,
  notFoundComponent: () => (
    <section className="page-width catalog-message">
      <h1>Página não encontrada</h1>
      <Link to="/" search={defaultSearch} className="text-link">
        Voltar ao início
      </Link>
    </section>
  ),
  errorComponent: ({ reset }) => (
    <section className="page-width catalog-message" role="alert">
      <h1>Não foi possível abrir esta página.</h1>
      <button onClick={reset}>Tentar novamente</button>
    </section>
  ),
});
const index = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: parseCatalogSearch,
  component: CatalogPage,
});
const detail = createRoute({
  getParentRoute: () => rootRoute,
  path: "/nfts/$nftId",
  validateSearch: parseDetailSearch,
  component: lazyRouteComponent(
    () => import("../features/nft-detail/page"),
    "NftDetailPage",
  ),
});
const diagnostics = createRoute({
  getParentRoute: () => rootRoute,
  path: "/diagnostico",
  component: lazyRouteComponent(
    () => import("../features/diagnostics/page"),
    "DiagnosticsPage",
  ),
});
const login = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: parseAuthSearch,
  component: lazyRouteComponent(
    () => import("../features/auth/page"),
    "LoginPage",
  ),
});
const register = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  validateSearch: parseAuthSearch,
  component: lazyRouteComponent(
    () => import("../features/auth/page"),
    "RegisterPage",
  ),
});
const authenticated = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authenticated",
  beforeLoad: requireSession,
  component: Outlet,
});
const account = createRoute({
  getParentRoute: () => authenticated,
  path: "/account",
  validateSearch: parseAccountSearch,
  component: lazyRouteComponent(
    () => import("../features/auth/account-page"),
    "AccountPage",
  ),
});
const profile = createRoute({
  getParentRoute: () => authenticated,
  path: "/account/profile",
  validateSearch: parseAccountSearch,
  component: lazyRouteComponent(
    () => import("../features/auth/account-page"),
    "AccountPage",
  ),
});
const wallets = createRoute({
  getParentRoute: () => authenticated,
  path: "/account/wallets",
  validateSearch: parseAccountSearch,
  component: lazyRouteComponent(
    () => import("../features/auth/account-page"),
    "AccountPage",
  ),
});
const favorites = createRoute({
  getParentRoute: () => authenticated,
  path: "/account/favorites",
  validateSearch: parseAccountSearch,
  component: lazyRouteComponent(
    () => import("../features/auth/account-page"),
    "AccountPage",
  ),
});
const cart = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cart",
  component: lazyRouteComponent(
    () => import("../features/cart/page"),
    "CartPage",
  ),
});
const checkout = createRoute({
  getParentRoute: () => authenticated,
  path: "/checkout",
  component: lazyRouteComponent(
    () => import("../features/checkout/page"),
    "CheckoutPage",
  ),
});
const orders = createRoute({
  getParentRoute: () => authenticated,
  path: "/orders",
  component: lazyRouteComponent(
    () => import("../features/checkout/orders"),
    "OrdersPage",
  ),
});
const order = createRoute({
  getParentRoute: () => authenticated,
  path: "/orders/$orderId",
  component: lazyRouteComponent(
    () => import("../features/checkout/orders"),
    "OrderPage",
  ),
});
export const router = createRouter({
  routeTree: rootRoute.addChildren([
    index,
    detail,
    diagnostics,
    cart,
    login,
    register,
    authenticated.addChildren([
      account,
      profile,
      wallets,
      favorites,
      checkout,
      orders,
      order,
    ]),
  ]),
  scrollRestoration: true,
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
