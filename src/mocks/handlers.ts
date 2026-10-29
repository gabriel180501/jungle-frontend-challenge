import { realtimeHandler, realtimeHandlers } from "./realtime";
import { resetEvents } from "./event-bus";
import { checkoutHandlers } from "./checkout";
import { commerceLock, resetOrders } from "./order-store";
import { cartHandlers, resetCartScenarios } from "./cart";
import { resetCarts } from "./cart-store";
import { resetMarket } from "./market-state";
import { accountHandlers, resetAccountScenarios } from "./account";
import { authHandlers, resetAuthScenarios } from "./auth";
import { detailHandlers, resetDetailScenarios } from "./nft-detail";
import { catalogHandlers, resetCatalogScenarios } from "./catalog";
import { delay, http, HttpResponse } from "msw";
import type { Health } from "../features/diagnostics/contracts";

export const handlers = [
  http.post("/api/demo/reset", () =>
    commerceLock(() => {
      resetOrders();
      resetCarts();
      resetMarket();
      resetCartScenarios();
      resetAuthScenarios();
      resetAccountScenarios();
      resetCatalogScenarios();
      resetDetailScenarios();
      resetEvents();
      return new HttpResponse(null, { status: 204 });
    }),
  ),
  ...realtimeHandlers,
  ...checkoutHandlers,
  ...cartHandlers,
  ...accountHandlers,
  ...authHandlers,
  ...detailHandlers,
  ...catalogHandlers,
  http.get("/api/health", async () => {
    await delay(400);
    return HttpResponse.json<Health>({
      status: "ok",
      service: "API simulada Kurio",
    });
  }),
  realtimeHandler,
];
