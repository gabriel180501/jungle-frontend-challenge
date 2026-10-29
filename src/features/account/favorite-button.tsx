import { useLocation, useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { isCancel } from "axios";
import { useAuth } from "../auth/context";
import type { Nft } from "../catalog/contracts";
import { useFavorite } from "./favorites-hook";
import { cn } from "../../lib/utils";
export function FavoriteButton({
  nft,
  compact = false,
  className,
}: {
  nft: Nft;
  compact?: boolean;
  className?: string;
}) {
  const auth = useAuth(),
    state = useFavorite(nft);
  const href = useLocation({ select: (location) => location.href });
  const navigate = useNavigate();
  function toggle() {
    if (!auth.user) {
      void navigate({ to: "/login", search: { redirect: href, reason: "" } });
      return;
    }
    if (state.query.isError) {
      void state.query.refetch();
      return;
    }
    if (!state.pending && !state.query.isPending)
      state.mutation.mutate({ favorite: !state.favorite });
  }
  const failed = state.mutation.isError && !isCancel(state.mutation.error);
  const label = state.query.isError
    ? `Tentar carregar favoritos de ${nft.name}`
    : state.favorite
      ? `Remover ${nft.name} dos favoritos`
      : `Favoritar ${nft.name}`;
  return (
    <div
      className={cn(
        "favorite-control",
        compact && "favorite-compact",
        className,
      )}
    >
      <button
        data-testid={`favorite-${nft.id}`}
        type="button"
        aria-label={label}
        aria-pressed={
          auth.user && !state.query.isPending ? state.favorite : undefined
        }
        disabled={
          auth.loading ||
          state.pending ||
          (!!auth.user && state.query.isPending)
        }
        onClick={toggle}
        title={label}
      >
        <Heart
          size={compact ? 18 : 17}
          fill={state.favorite ? "currentColor" : "none"}
          aria-hidden="true"
        />
        {!compact && <span>{state.favorite ? "Favoritado" : "Favoritar"}</span>}
      </button>
      <span role="status" className="sr-only">
        {state.pending
          ? "Salvando favorito…"
          : state.mutation.isSuccess
            ? state.favorite
              ? "NFT salvo nos favoritos."
              : "NFT removido dos favoritos."
            : ""}
      </span>
      {failed && (
        <p className="favorite-error" role="alert">
          Não foi possível salvar. A alteração foi desfeita. Tente novamente.
        </p>
      )}
      {state.query.isError && (
        <p className="favorite-error" role="alert">
          Não foi possível carregar favoritos. Clique para tentar novamente.
        </p>
      )}
    </div>
  );
}
