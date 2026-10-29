import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./api";
export function CartLink({ mobile = false }: { mobile?: boolean }) {
  const cart = useCart();
  const count =
    cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  return (
    <Link
      to="/cart"
      className="cart-link"
      aria-label={mobile ? "Carrinho" : "Abrir carrinho"}
    >
      <ShoppingBag size={20} />
      {count > 0 && (
        <span
          className="cart-badge"
          aria-label={`${count} unidades no carrinho`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
