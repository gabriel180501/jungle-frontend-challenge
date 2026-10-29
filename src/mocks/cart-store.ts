import type { StoredCart } from "../features/cart/contracts";
import { getNftDetail } from "./fixtures/nft-details";
const key = "kurio.mock.carts.v1";
const guestCookie = "kurio.mock.guest";
type Carts = Record<string, StoredCart>;
export function readGuest() {
  return (
    document.cookie
      .split("; ")
      .find((value) => value.startsWith(`${guestCookie}=`))
      ?.slice(guestCookie.length + 1) ?? ""
  );
}
export function guestOwner() {
  let id = readGuest();
  if (!id) {
    id = crypto.randomUUID();
    document.cookie = `${guestCookie}=${id}; Path=/; SameSite=Strict; Max-Age=2592000${location.protocol === "https:" ? "; Secure" : ""}`;
  }
  return `guest:${id}`;
}
export function loadCarts(): Carts {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}
export function emptyCart(): StoredCart {
  return { items: [], coupon: "", version: 0, notices: [] };
}
export function saveCarts(carts: Carts) {
  localStorage.setItem(key, JSON.stringify(carts));
}
export function mergeGuestCart(userId: string) {
  const guestId = readGuest();
  if (!guestId) return;
  const carts = loadCarts(),
    guest = carts[`guest:${guestId}`];
  if (guest) {
    const target = carts[`user:${userId}`] ?? emptyCart();
    for (const line of guest.items) {
      const existing = target.items.find(
        (item) =>
          item.nftId === line.nftId && item.editionId === line.editionId,
      );
      const edition = getNftDetail(line.nftId)?.editions.find(
        (e) => e.id === line.editionId,
      );
      const desired = (existing?.quantity ?? 0) + line.quantity;
      // Sem estoque: mantém a intenção para informar o conflito, sem apagar o item.
      const quantity =
        edition && edition.available > 0
          ? Math.min(desired, edition.maxPerOrder, edition.available)
          : desired;
      if (quantity !== desired)
        target.notices.push(
          "A união dos carrinhos ajustou quantidades ao limite disponível. Confira os itens.",
        );
      if (existing) existing.quantity = quantity;
      else target.items.push({ ...line, quantity });
    }
    target.coupon ||= guest.coupon;
    target.version++;
    carts[`user:${userId}`] = target;
    delete carts[`guest:${guestId}`];
    saveCarts(carts);
  }
  document.cookie = `${guestCookie}=; Path=/; SameSite=Strict; Max-Age=0`;
}
export function resetCarts() {
  localStorage.removeItem(key);
  document.cookie = `${guestCookie}=; Path=/; SameSite=Strict; Max-Age=0`;
}
