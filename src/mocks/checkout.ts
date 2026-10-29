import { emitBusiness } from "./event-bus";
import { delay, http, HttpResponse } from "msw";
import { inspectSession, clearSession } from "./auth-database";
import { loadCarts, emptyCart, saveCarts } from "./cart-store";
import { cartQuote, cartSnapshot } from "./cart";
import {
  changePricing,
  commerceChanged,
  holdStock,
  settleStock,
  notifyStock,
} from "./market-state";
import {
  atomic,
  commerceLock,
  loadOrders,
  saveOrders,
  settings,
  publicOrder,
  type InternalOrder,
  type OrdersDB,
} from "./order-store";
import { validateCollector } from "../features/checkout/validation";
import type {
  CheckoutError,
  CheckoutQuote,
  Collector,
  Connection,
  Review,
  ReviewInput,
} from "../features/checkout/contracts";
import { networks, type Network } from "../features/catalog/contracts";
import { isEth } from "../lib/eth";
function error(
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string>,
) {
  return HttpResponse.json<CheckoutError>(
    { code, message, ...(fields ? { fields } : {}) },
    { status },
  );
}
function principal() {
  const session = inspectSession();
  if (!session.valid) {
    if (session.token) clearSession();
    return null;
  }
  return { userId: session.user!.id, token: session.token };
}
const expired = () =>
  error("SESSION_EXPIRED", "Sua sessão expirou. Entre novamente.", 401);
function same(access: { userId: string; token: string }) {
  const current = principal();
  return current?.userId === access.userId && current.token === access.token;
}
function selectedCart(userId: string, network: Network): CheckoutQuote {
  const all = cartSnapshot(
    `user:${userId}`,
    loadCarts()[`user:${userId}`] ?? emptyCart(),
  );
  const items = all.items.filter((item) => item.network === network);
  return {
    userId,
    items,
    otherItems: all.items
      .filter((item) => item.network !== network)
      .reduce((sum, i) => sum + i.quantity, 0),
    quote: cartQuote({ ...all, items }),
  };
}
function connection(
  db: OrdersDB,
  id: string,
  access: { userId: string; token: string },
) {
  const conn = db.connections[id];
  const wallet = inspectSession().db.wallets[access.userId]?.find(
    (w) => w.id === conn?.walletId,
  );
  if (
    !conn ||
    !conn.connected ||
    conn.userId !== access.userId ||
    conn.token !== access.token ||
    Date.parse(conn.expiresAt) <= Date.now() ||
    !wallet ||
    wallet.version !== conn.walletVersion ||
    wallet.network !== conn.network
  )
    return null;
  return { conn, wallet };
}
function settle(
  db: OrdersDB,
  order: InternalOrder,
  force?: "confirmed" | "rejected",
) {
  if (order.status !== "pending") return;
  if (!force && (order.outcome === "pending" || Date.now() < order.resolveAt))
    return;
  atomic(() => {
    const confirmed = force
      ? force === "confirmed"
      : order.outcome === "confirm";
    settleStock(order.snapshot.items, confirmed);
    if (confirmed) {
      const carts = loadCarts(),
        cart = carts[`user:${order.userId}`] ?? emptyCart();
      for (const bought of order.snapshot.items) {
        const line = cart.items.find(
          (i) => i.nftId === bought.nftId && i.editionId === bought.editionId,
        );
        if (line) line.quantity = Math.max(0, line.quantity - bought.quantity);
      }
      cart.items = cart.items.filter((i) => i.quantity > 0);
      cart.version++;
      if (!cart.items.length) cart.coupon = "";
      carts[`user:${order.userId}`] = cart;
      saveCarts(carts);
    }
    order.version++;
    order.status = confirmed ? "confirmed" : "rejected";
    order.updatedAt = new Date().toISOString();
    order.transaction = confirmed ? `SIM-${crypto.randomUUID()}` : null;
    order.reason = confirmed
      ? null
      : "A transação foi recusada pela carteira na simulação. Seus itens foram preservados.";
    saveOrders(db);
  });
  notifyStock(order.snapshot.items);
  emitBusiness(
    "order.updated",
    order.id,
    order.version,
    order.userId,
    order.status,
  );
  commerceChanged("order");
}
function persist<T>(operation: () => T) {
  try {
    return atomic(operation);
  } catch {
    return error(
      "STORAGE_FULL",
      "Não foi possível salvar a operação. Libere espaço e recupere a tentativa.",
      507,
    );
  }
}
export const checkoutHandlers = [
  http.post("/api/wallet-connections", async ({ request }) => {
    const access = principal();
    if (!access) return expired();
    const body = (await request.json()) as {
      walletId: string;
      network: Network;
    };
    await delay(250);
    if (!same(access)) return expired();
    return commerceLock(() => {
      if (!same(access)) return expired();
      const wallet = inspectSession().db.wallets[access.userId]?.find(
        (w) => w.id === body.walletId,
      );
      if (!wallet)
        return error(
          "WALLET_NOT_FOUND",
          "Cadastre e selecione uma carteira da sua conta.",
          422,
        );
      if (wallet.network !== body.network)
        return error(
          "NETWORK_MISMATCH",
          "A rede selecionada não corresponde à carteira.",
          422,
        );
      const scenario = settings(access.userId);
      if (scenario.wallet === "refuse")
        return error(
          "WALLET_REFUSED",
          "Conexão recusada na simulação. Tente novamente.",
          403,
        );
      const conn: Connection = {
        id: crypto.randomUUID(),
        userId: access.userId,
        walletId: wallet.id,
        walletVersion: wallet.version,
        network: wallet.network,
        connected: true,
        expiresAt: new Date(
          Date.now() + (scenario.wallet === "disconnect" ? 1500 : 15 * 60000),
        ).toISOString(),
      };
      return persist(() => {
        const db = loadOrders();
        db.connections[conn.id] = { ...conn, token: access.token };
        saveOrders(db);
        return HttpResponse.json(conn, { status: 201 });
      });
    });
  }),
  http.get("/api/wallet-connections/:id", ({ params }) => {
    const access = principal();
    if (!access) return expired();
    const db = loadOrders(),
      saved = db.connections[String(params.id)];
    if (!saved) return error("NOT_FOUND", "Conexão não encontrada.", 404);
    if (saved.userId !== access.userId)
      return error("FORBIDDEN", "Conexão de outra conta.", 403);
    const { token: _token, ...result } = saved;
    return HttpResponse.json({
      ...result,
      connected: !!connection(db, saved.id, access),
    });
  }),
  http.delete("/api/wallet-connections/:id", ({ params }) =>
    commerceLock(() => {
      const access = principal();
      if (!access) return expired();
      const db = loadOrders(),
        saved = db.connections[String(params.id)];
      if (saved && saved.userId !== access.userId)
        return error("FORBIDDEN", "Conexão de outra conta.", 403);
      return persist(() => {
        if (saved) saved.connected = false;
        saveOrders(db);
        return new HttpResponse(null, { status: 204 });
      });
    }),
  ),
  http.post("/api/checkout/quote", async ({ request }) => {
    const access = principal();
    if (!access) return expired();
    const body = (await request.json()) as { network: Network };
    await delay(180);
    if (!same(access)) return expired();
    if (!networks.includes(body.network))
      return error("VALIDATION_ERROR", "Selecione uma rede.", 422);
    return HttpResponse.json(selectedCart(access.userId, body.network));
  }),
  http.post("/api/checkout/review", async ({ request }) => {
    const access = principal();
    if (!access) return expired();
    const body = (await request.json()) as ReviewInput;
    await delay(180);
    return commerceLock(() => {
      if (!same(access)) return expired();
      const db = loadOrders(),
        active = connection(db, body.connectionId, access);
      if (!active)
        return error(
          "WALLET_DISCONNECTED",
          "Conecte a carteira novamente antes de revisar.",
          409,
        );
      const fields = validateCollector(
        body.collector ?? ({} as Collector),
        active.conn.network,
      );
      if (Object.keys(fields).length)
        return error(
          "VALIDATION_ERROR",
          "Confira os campos do colecionador.",
          422,
          fields,
        );
      const selected = selectedCart(access.userId, active.conn.network);
      if (!selected.quote.valid)
        return error(
          "QUOTE_INVALID",
          selected.quote.problems.join(" ") ||
            "Não há itens disponíveis nesta rede.",
          409,
        );
      const collector = Object.fromEntries(
        [
          "displayName",
          "username",
          "profileName",
          "referralCode",
          "email",
          "ens",
          "secondaryReference",
          "note",
        ].map((key) => [key, body.collector[key as keyof Collector].trim()]),
      ) as unknown as Collector;
      const review: Review = {
        id: crypto.randomUUID(),
        userId: access.userId,
        connectionId: active.conn.id,
        expiresAt: selected.quote.expiresAt,
        snapshot: {
          ...selected,
          collector,
          wallet: structuredClone(active.wallet),
          network: active.conn.network,
        },
      };
      return persist(() => {
        db.reviews[review.id] = review;
        saveOrders(db);
        return HttpResponse.json(review, { status: 201 });
      });
    });
  }),
  http.post("/api/orders", async ({ request }) => {
    const access = principal();
    if (!access) return expired();
    const body = (await request.json()) as { reviewId: string };
    const key = request.headers.get("Idempotency-Key") ?? "";
    if (
      !/^[a-zA-Z0-9_-]{8,100}$/.test(key) ||
      typeof body.reviewId !== "string"
    )
      return error(
        "VALIDATION_ERROR",
        "Informe a revisão e uma chave de idempotência válida.",
        422,
      );
    await delay(200);
    let timeout = false;
    const result = await commerceLock(() => {
      if (!same(access)) return expired();
      const db = loadOrders();
      const existing = Object.values(db.orders).find(
        (o) => o.userId === access.userId && o.attemptKey === key,
      );
      if (existing) {
        if (existing.reviewId !== body.reviewId)
          return error(
            "IDEMPOTENCY_CONFLICT",
            "Esta chave já foi usada com outro conteúdo.",
            409,
          );
        settle(db, existing);
        return HttpResponse.json(publicOrder(existing));
      }
      const review = db.reviews[body.reviewId];
      if (!review)
        return error(
          "NOT_FOUND",
          "Revisão não encontrada. Revise a compra novamente.",
          404,
        );
      if (review.userId !== access.userId)
        return error("FORBIDDEN", "Esta revisão pertence a outra conta.", 403);
      if (
        Object.values(db.orders).some(
          (o) => o.userId === access.userId && o.status === "pending",
        )
      )
        return error(
          "ORDER_PENDING",
          "Já há um pedido pendente. Acompanhe-o em Meus pedidos.",
          409,
        );
      if (Object.values(db.orders).some((o) => o.reviewId === review.id))
        return error(
          "REVIEW_USED",
          "Esta revisão já foi enviada. Consulte Meus pedidos ou revise novamente.",
          409,
        );
      if (!connection(db, review.connectionId, access))
        return error(
          "WALLET_DISCONNECTED",
          "A carteira foi desconectada. Conecte e revise novamente.",
          409,
        );
      const fresh = selectedCart(access.userId, review.snapshot.network);
      if (
        Date.parse(review.expiresAt) <= Date.now() ||
        fresh.quote.fingerprint !== review.snapshot.quote.fingerprint ||
        !fresh.quote.valid
      )
        return error(
          "QUOTE_CHANGED",
          "Preço, estoque, cupom ou taxa mudou, ou a revisão expirou. Revise os valores e confirme novamente.",
          409,
        );
      const scenario = settings(access.userId);
      if (scenario.order === "offline")
        return error(
          "TRANSIENT_FAILURE",
          "Consulta/envio de pedidos indisponível. Tente recuperar a tentativa.",
          503,
        );
      if (scenario.order === "fail-once") {
        db.settings[access.userId] = { ...scenario, order: "confirm" };
        saveOrders(db);
        return error(
          "TRANSIENT_FAILURE",
          "Falha antes do envio. Recupere a mesma tentativa para continuar.",
          503,
        );
      }
      const now = new Date().toISOString();
      const order: InternalOrder = {
        id: crypto.randomUUID(),
        version: 1,
        userId: access.userId,
        attemptKey: key,
        reviewId: review.id,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        snapshot: structuredClone(review.snapshot),
        transaction: null,
        reason: null,
        resolveAt: Date.now() + 3000,
        outcome:
          scenario.order === "reject"
            ? "reject"
            : scenario.order === "pending"
              ? "pending"
              : "confirm",
      };
      timeout = scenario.order === "timeout-confirm";
      const response = persist(() => {
        holdStock(order.snapshot.items);
        db.orders[order.id] = order;
        saveOrders(db);
        return HttpResponse.json(publicOrder(order), { status: 201 });
      });
      if (response.status === 201) {
        notifyStock(order.snapshot.items);
        emitBusiness(
          "order.updated",
          order.id,
          order.version,
          order.userId,
          order.status,
        );
      }
      commerceChanged("order");
      return response;
    });
    if (timeout) await delay(4500);
    return result;
  }),
  http.get("/api/orders/by-key/:key", ({ params }) =>
    commerceLock(() => {
      const access = principal();
      if (!access) return expired();
      if (settings(access.userId).order === "offline")
        return HttpResponse.error();
      const db = loadOrders(),
        order = Object.values(db.orders).find(
          (o) => o.userId === access.userId && o.attemptKey === params.key,
        );
      if (!order)
        return error("NOT_FOUND", "Tentativa ainda não localizada.", 404);
      settle(db, order);
      return HttpResponse.json(publicOrder(order));
    }),
  ),
  http.get("/api/orders/:id", ({ params }) =>
    commerceLock(() => {
      const access = principal();
      if (!access) return expired();
      if (settings(access.userId).order === "offline")
        return HttpResponse.error();
      const db = loadOrders(),
        order = db.orders[String(params.id)];
      if (!order) return error("NOT_FOUND", "Pedido não encontrado.", 404);
      if (order.userId !== access.userId)
        return error("FORBIDDEN", "Você não tem acesso a este pedido.", 403);
      settle(db, order);
      return HttpResponse.json(publicOrder(order));
    }),
  ),
  http.get("/api/orders", () =>
    commerceLock(() => {
      const access = principal();
      if (!access) return expired();
      if (settings(access.userId).order === "offline")
        return HttpResponse.error();
      const db = loadOrders(),
        items = Object.values(db.orders).filter(
          (o) => o.userId === access.userId,
        );
      items.forEach((o) => settle(db, o));
      return HttpResponse.json({
        userId: access.userId,
        items: items
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(publicOrder),
      });
    }),
  ),
  http.post("/api/demo/orders/scenario", async ({ request }) => {
    const access = principal();
    if (!access) return expired();
    const body = (await request.json()) as { wallet?: string; order?: string };
    if (
      (body.wallet &&
        !["connect", "refuse", "disconnect"].includes(body.wallet)) ||
      (body.order &&
        ![
          "confirm",
          "reject",
          "pending",
          "timeout-confirm",
          "fail-once",
          "offline",
        ].includes(body.order))
    )
      return error("VALIDATION_ERROR", "Cenário inválido.", 422);
    return commerceLock(() =>
      persist(() => {
        if (!same(access)) return expired();
        const db = loadOrders();
        db.settings[access.userId] = {
          ...settings(access.userId),
          ...body,
        } as ReturnType<typeof settings>;
        saveOrders(db);
        return new HttpResponse(null, { status: 204 });
      }),
    );
  }),
  http.post("/api/demo/orders/:id/resolve", async ({ request, params }) => {
    const access = principal();
    if (!access) return expired();
    const body = (await request.json()) as { status: "confirmed" | "rejected" };
    return commerceLock(() => {
      if (!same(access)) return expired();
      const db = loadOrders(),
        order = db.orders[String(params.id)];
      if (!order) return error("NOT_FOUND", "Pedido não encontrado.", 404);
      if (order.userId !== access.userId)
        return error("FORBIDDEN", "Pedido de outra conta.", 403);
      if (!["confirmed", "rejected"].includes(body.status))
        return error("VALIDATION_ERROR", "Estado inválido.", 422);
      settle(db, order, body.status);
      return HttpResponse.json(publicOrder(order));
    });
  }),
  http.post("/api/demo/pricing", async ({ request }) => {
    const body = (await request.json()) as {
      networkFee: string;
      couponExpired: boolean;
    };
    if (!isEth(body.networkFee) || typeof body.couponExpired !== "boolean")
      return error("VALIDATION_ERROR", "Taxa ou validade inválida.", 422);
    return commerceLock(() => {
      changePricing(body.networkFee, body.couponExpired);
      return new HttpResponse(null, { status: 204 });
    });
  }),
];

export async function settleDueOrders() {
  if (
    !Object.values(loadOrders().orders).some(
      (order) =>
        order.status === "pending" &&
        order.outcome !== "pending" &&
        order.resolveAt <= Date.now(),
    )
  )
    return;
  await commerceLock(() => {
    const db = loadOrders();
    for (const order of Object.values(db.orders)) settle(db, order);
  });
}
