import {
  holdCart,
  waitCart,
  releaseCart,
  resetCartGates,
  cartGateState,
} from "./cart-delay";
import { commerceLock } from "./order-store";
import { delay, http, HttpResponse } from "msw";
import { clearSession, inspectSession, readToken } from "./auth-database";
import { emptyCart, guestOwner, loadCarts, saveCarts } from "./cart-store";
import { getNftDetail } from "./fixtures/nft-details";
import { changeMarket, commerceChanged, pricing } from "./market-state";
import { ethToWei, isEth, multiplyEth, weiToEth } from "../lib/eth";
import {
  itemId,
  type Cart,
  type CartError,
  type CartInput,
  type Quote,
  type StoredCart,
} from "../features/cart/contracts";
const modes = new Map<string, string>();
export function resetCartScenarios() {
  resetCartGates();
  modes.clear();
}
function error(code: string, message: string, status: number) {
  return HttpResponse.json<CartError>({ code, message }, { status });
}
function identity() {
  const session = inspectSession();
  if (session.token && !session.valid) {
    clearSession();
    return null;
  }
  return session.valid ? `user:${session.user!.id}` : guestOwner();
}
export function cartSnapshot(owner: string, stored: StoredCart): Cart {
  return {
    owner,
    version: stored.version,
    coupon: stored.coupon,
    notices: [...new Set(stored.notices)],
    items: stored.items.map((line) => {
      const nft = getNftDetail(line.nftId),
        edition = nft?.editions.find((e) => e.id === line.editionId);
      const limit = edition
        ? Math.min(edition.available, edition.maxPerOrder)
        : 0;
      return {
        ...line,
        id: itemId(line.nftId, line.editionId),
        name: nft?.name ?? "NFT indisponível",
        image: nft?.image ?? "",
        tokenId: nft?.tokenId ?? "",
        network: nft?.network ?? "",
        edition: edition?.label ?? line.editionId,
        unitPrice: edition?.price ?? "0",
        total: multiplyEth(edition?.price ?? "0", line.quantity),
        available: edition?.available ?? 0,
        limit,
        problem:
          !edition || limit === 0
            ? "Esta edição está indisponível. Remova o item para continuar."
            : line.quantity > limit
              ? `Disponibilidade alterada: ajuste para no máximo ${limit}.`
              : "",
      };
    }),
  };
}
function couponError(code: string) {
  return !code || (code === "KURIO10" && !pricing().couponExpired)
    ? ""
    : code === "EXPIRADO" || (code === "KURIO10" && pricing().couponExpired)
      ? "Este cupom expirou."
      : "Código promocional inválido.";
}
export function cartQuote(cart: Cart): Quote {
  const subtotal = cart.items.reduce(
    (sum, item) => sum + ethToWei(item.total),
    0n,
  );
  const problem = couponError(cart.coupon);
  const discount =
    cart.coupon === "KURIO10" && !problem ? (subtotal * 10n) / 100n : 0n;
  const fee = cart.items.length
    ? ethToWei(pricing().networkFee) *
      BigInt(new Set(cart.items.map((i) => i.network)).size)
    : 0n;
  const problems = cart.items
    .filter((i) => i.problem)
    .map((i) => `${i.name} (${i.edition}): ${i.problem}`);
  if (problem) problems.push(problem);
  const fingerprint = JSON.stringify({
    version: cart.version,
    items: cart.items.map((i) => [
      i.id,
      i.quantity,
      i.unitPrice,
      i.available,
      i.limit,
    ]),
    coupon: cart.coupon,
    discount: discount.toString(),
    fee: fee.toString(),
  });
  return {
    owner: cart.owner,
    cartVersion: cart.version,
    fingerprint,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    subtotal: weiToEth(subtotal),
    discount: weiToEth(discount),
    networkFee: weiToEth(fee),
    total: weiToEth(subtotal - discount + fee),
    coupon: cart.coupon,
    couponError: problem,
    valid: cart.items.length > 0 && !problems.length,
    problems,
  };
}
async function context(mutation: boolean) {
  const owner = identity(),
    token = readToken();
  if (!owner)
    return {
      response: error(
        "SESSION_EXPIRED",
        "Sua sessão expirou. Entre novamente.",
        401,
      ),
    };
  const mode = modes.get(owner);
  if (mutation) await waitCart(owner);
  await delay(mode === "slow" ? 1600 : 180);
  if (identity() !== owner || readToken() !== token)
    return {
      response: error(
        "SESSION_CHANGED",
        "A sessão mudou. Atualize o carrinho.",
        409,
      ),
    };
  if (mode === "offline") return { response: HttpResponse.error() };
  if (mutation && mode === "fail-once") {
    modes.delete(owner);
    return {
      response: error(
        "TRANSIENT_FAILURE",
        "Não foi possível salvar o carrinho. Tente novamente.",
        503,
      ),
    };
  }
  return { owner, token };
}
type MutationBody = Partial<CartInput> & { version?: number; coupon?: string };
function validVersion(body: MutationBody, stored: StoredCart) {
  return Number.isSafeInteger(body.version) && body.version === stored.version;
}
export const cartHandlers = [
  http.get("/api/cart", async () => {
    const ctx = await context(false);
    if (ctx.response) return ctx.response;
    return HttpResponse.json(
      cartSnapshot(ctx.owner!, loadCarts()[ctx.owner!] ?? emptyCart()),
    );
  }),
  http.post("/api/cart/quote", async () => {
    const ctx = await context(false);
    if (ctx.response) return ctx.response;
    return HttpResponse.json(
      cartQuote(
        cartSnapshot(ctx.owner!, loadCarts()[ctx.owner!] ?? emptyCart()),
      ),
    );
  }),
  ...(["post", "put", "delete"] as const).map((method) =>
    http[method]("/api/cart/items", async ({ request }) => {
      const body = (await request.json()) as MutationBody;
      const ctx = await context(true);
      if (ctx.response) return ctx.response;
      return commerceLock(() => {
        if (identity() !== ctx.owner || readToken() !== ctx.token)
          return error(
            "SESSION_CHANGED",
            "A sessão mudou. Atualize o carrinho.",
            409,
          );
        const carts = loadCarts(),
          owner = ctx.owner!,
          stored = carts[owner] ?? emptyCart();
        if (!validVersion(body, stored))
          return error(
            "CART_CONFLICT",
            "O carrinho mudou. Confira os dados atualizados e tente novamente.",
            409,
          );
        if (
          typeof body.nftId !== "string" ||
          typeof body.editionId !== "string"
        )
          return error("VALIDATION_ERROR", "Informe o NFT e a edição.", 422);
        const index = stored.items.findIndex(
          (i) => i.nftId === body.nftId && i.editionId === body.editionId,
        );
        if (method === "delete") {
          if (index >= 0) stored.items.splice(index, 1);
        } else {
          if (
            !Number.isSafeInteger(body.quantity) ||
            body.quantity! < 1 ||
            body.quantity! > 99
          )
            return error(
              "VALIDATION_ERROR",
              "Quantidade deve ser inteira entre 1 e 99.",
              422,
            );
          const nft = getNftDetail(body.nftId),
            edition = nft?.editions.find((e) => e.id === body.editionId);
          if (!nft || !edition)
            return error("NOT_FOUND", "NFT ou edição não encontrado.", 404);
          const quantity =
            body.quantity! +
            (method === "post" && index >= 0
              ? stored.items[index].quantity
              : 0);
          if (quantity > Math.min(edition.available, edition.maxPerOrder))
            return error(
              "AVAILABILITY_CONFLICT",
              "A quantidade excede o estoque ou limite desta edição. Atualize o NFT/carrinho.",
              409,
            );
          const line: CartInput = {
            nftId: body.nftId,
            editionId: body.editionId,
            quantity,
          };
          if (index >= 0) stored.items[index] = line;
          else stored.items.push(line);
        }
        stored.version++;
        stored.notices = [];
        carts[owner] = stored;
        try {
          saveCarts(carts);
        } catch {
          return error(
            "STORAGE_FULL",
            "Não foi possível persistir o carrinho.",
            507,
          );
        }
        commerceChanged("cart", owner);
        return HttpResponse.json(cartSnapshot(owner, stored));
      });
    }),
  ),
  http.put("/api/cart/coupon", async ({ request }) => {
    const body = (await request.json()) as MutationBody;
    const ctx = await context(true);
    if (ctx.response) return ctx.response;
    return commerceLock(() => {
      if (identity() !== ctx.owner || readToken() !== ctx.token)
        return error(
          "SESSION_CHANGED",
          "A sessão mudou. Atualize o carrinho.",
          409,
        );
      const carts = loadCarts(),
        owner = ctx.owner!,
        stored = carts[owner] ?? emptyCart();
      if (!validVersion(body, stored))
        return error(
          "CART_CONFLICT",
          "O carrinho mudou. Tente novamente.",
          409,
        );
      if (typeof body.coupon !== "string" || body.coupon.length > 40)
        return error("VALIDATION_ERROR", "Código promocional inválido.", 422);
      const code = body.coupon.trim().toUpperCase(),
        problem = couponError(code);
      if (problem)
        return error(
          code === "EXPIRADO" || (code === "KURIO10" && pricing().couponExpired)
            ? "COUPON_EXPIRED"
            : "COUPON_INVALID",
          problem,
          422,
        );
      stored.coupon = code;
      stored.version++;
      stored.notices = [];
      carts[owner] = stored;
      try {
        saveCarts(carts);
      } catch {
        return error(
          "STORAGE_FULL",
          "Não foi possível persistir o cupom.",
          507,
        );
      }
      commerceChanged("cart", owner);
      return HttpResponse.json(cartSnapshot(owner, stored));
    });
  }),
  http.post("/api/demo/cart/scenario", async ({ request }) => {
    const body = (await request.json()) as { mode: string };
    const owner = identity();
    if (!owner) return error("SESSION_EXPIRED", "Entre novamente.", 401);
    if (
      !["default", "slow", "fail-once", "offline", "hold"].includes(body.mode)
    )
      return error("VALIDATION_ERROR", "Cenário inválido.", 422);
    modes.set(owner, body.mode);
    if (body.mode === "hold")
      return HttpResponse.json({ gateId: holdCart(owner) });
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/api/demo/cart/hold/:id", ({ params }) =>
    HttpResponse.json({ state: cartGateState(String(params.id)) }),
  ),
  http.post("/api/demo/cart/release", async ({ request }) => {
    const { gateId } = (await request.json()) as { gateId: string };
    if (!releaseCart(gateId))
      return error("NOT_FOUND", "Retenção não encontrada.", 404);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("/api/demo/market", async ({ request }) => {
    const body = (await request.json()) as {
      nftId: string;
      editionId: string;
      price?: string;
      available?: number;
    };
    const edition = getNftDetail(body.nftId)?.editions.find(
      (e) => e.id === body.editionId,
    );
    if (!edition)
      return error("NOT_FOUND", "NFT ou edição não encontrado.", 404);
    if (
      (body.price !== undefined && !isEth(body.price)) ||
      (body.available !== undefined &&
        (!Number.isSafeInteger(body.available) ||
          body.available < 0 ||
          body.available > 99))
    )
      return error("VALIDATION_ERROR", "Preço ou estoque inválido.", 422);
    return commerceLock(() => {
      changeMarket(body.nftId, body.editionId, {
        ...(body.price !== undefined ? { price: body.price } : {}),
        ...(body.available !== undefined ? { available: body.available } : {}),
      });
      return new HttpResponse(null, { status: 204 });
    });
  }),
];
