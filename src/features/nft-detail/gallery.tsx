import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import type { NftMedia } from "./contracts";
import { Button } from "../../components/ui/button";
export function NftGallery({
  media,
  name,
}: {
  media: NftMedia[];
  name: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = media[selectedIndex] ?? media[0];
  function move(direction: number) {
    setSelectedIndex(
      (index) => (index + direction + media.length) % media.length,
    );
  }
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      move(event.key === "ArrowRight" ? 1 : -1);
    }
  }
  return (
    <section
      className="nft-gallery"
      aria-label={`Galeria de ${name}`}
      onKeyDown={onKeyDown}
    >
      <div
        className="gallery-thumbnails"
        role="group"
        aria-label="Imagens do NFT"
      >
        {media.map((item, index) => (
          <button
            key={item.id}
            aria-label={`Imagem ${index + 1}: ${item.view === "full" ? "obra completa" : item.view === "face" ? "rosto" : item.view === "accessory" ? "acessórios" : "vestimenta"}`}
            aria-pressed={selectedIndex === index}
            onClick={() => setSelectedIndex(index)}
          >
            <span className={`gallery-image view-${item.view}`}>
              <img src={item.src} alt="" width="640" height="640" />
            </span>
          </button>
        ))}
      </div>
      <div className="gallery-main">
        <div
          className={`gallery-image view-${selected.view}`}
          data-testid="gallery-main"
        >
          <img
            src={selected.src}
            alt={selected.alt}
            width="640"
            height="640"
            fetchPriority="high"
          />
        </div>
        <button
          className="expand-image"
          aria-label="Ampliar imagem do NFT"
          onClick={() => dialog.current?.showModal()}
        >
          <Expand size={19} />
        </button>
        <div className="gallery-mobile-controls">
          <button aria-label="Imagem anterior" onClick={() => move(-1)}>
            <ChevronLeft size={18} />
          </button>
          <span role="status">
            Imagem {selectedIndex + 1} de {media.length}
          </span>
          <button aria-label="Próxima imagem" onClick={() => move(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <dialog
        ref={dialog}
        className="gallery-dialog"
        aria-labelledby="gallery-dialog-title"
      >
        <header>
          <h2 id="gallery-dialog-title">
            {name} · Imagem {selectedIndex + 1} de {media.length}
          </h2>
          <form method="dialog">
            <button aria-label="Fechar imagem ampliada">
              <X size={20} />
            </button>
          </form>
        </header>
        <div className={`gallery-image view-${selected.view}`}>
          <img src={selected.src} alt={selected.alt} width="640" height="640" />
        </div>
        <div className="gallery-dialog-controls">
          <Button variant="outline" onClick={() => move(-1)}>
            <ChevronLeft size={16} /> Anterior
          </Button>
          <Button variant="outline" onClick={() => move(1)}>
            Próxima <ChevronRight size={16} />
          </Button>
        </div>
      </dialog>
    </section>
  );
}
