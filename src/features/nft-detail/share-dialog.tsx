import { useRef, useState } from "react";
import { Copy, Share2, X } from "lucide-react";
import { Button } from "../../components/ui/button";
export function ShareNft({ id, edition }: { id: string; edition: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("");
  const url = new URL(`/nfts/${encodeURIComponent(id)}`, location.origin);
  if (edition) url.searchParams.set("edition", edition);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url.href);
      setFeedback("Link copiado.");
    } catch {
      input.current?.select();
      setFeedback(
        "Não foi possível copiar automaticamente. Selecione e copie o link acima.",
      );
    }
  }
  return (
    <>
      <button
        className="share-nft"
        onClick={() => {
          setFeedback("");
          dialog.current?.showModal();
        }}
      >
        <Share2 size={16} /> Compartilhar este NFT
      </button>
      <dialog
        className="share-dialog"
        ref={dialog}
        aria-labelledby="share-title"
      >
        <header>
          <h2 id="share-title">Compartilhar NFT</h2>
          <form method="dialog">
            <button aria-label="Fechar compartilhamento">
              <X size={20} />
            </button>
          </form>
        </header>
        <label htmlFor="share-url">Link para este NFT</label>
        <input id="share-url" ref={input} readOnly value={url.href} />
        <Button onClick={() => void copy()}>
          <Copy size={16} /> Copiar link
        </Button>
        <p role="status">{feedback}</p>
      </dialog>
    </>
  );
}
