import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Search,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useRef } from "react";
import { catalogOptions } from "./api";
import { defaultSearch } from "./search";
import type { CatalogSearch } from "./contracts";
import { collectionOptions } from "./contracts";
import { Filters } from "./filters";
import { NftCard } from "./nft-card";
import { Button } from "../../components/ui/button";

export function CatalogPage() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const query = useQuery(catalogOptions(search));
  const drawer = useRef<HTMLDialogElement>(null);
  function update(patch: Partial<CatalogSearch>) {
    void navigate({
      search: (previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }),
      resetScroll: false,
    });
  }
  const hasFilters = !!(
    search.q ||
    search.collections.length ||
    search.networks.length ||
    search.minPrice ||
    search.maxPrice ||
    search.tab !== "all"
  );
  return (
    <>
      <section className="hero page-width" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Bem-vindo à Kurio</p>
          <h1 id="hero-title">
            SEJA DONO DO FUTURO
            <br />
            DA ARTE DIGITAL
          </h1>
          <p className="hero-description">
            Descubra NFTs selecionados de criadores emergentes e consagrados.
            Colecione arte digital rara, apoie artistas e tenha uma parte da
            cultura da internet.
          </p>
          <Button asChild>
            <a href="#catalogo">
              EXPLORAR <ArrowRight size={15} />
            </a>
          </Button>
        </div>
        <div className="hero-art">
          <img
            src="/images/emerald-ape.webp"
            alt="Emerald Ape, personagem de jaqueta verde e óculos, destaque da coleção Kurio"
            width="640"
            height="640"
            fetchPriority="high"
          />
          <span className="hero-label">KURIO EDITIONS · 001</span>
        </div>
      </section>
      <section
        id="catalogo"
        className="catalog-layout page-width"
        aria-label="Catálogo de NFTs"
      >
        <aside className="catalog-sidebar" aria-label="Filtros do catálogo">
          <Filters
            search={search}
            facets={query.data?.facets}
            onChange={update}
          />
          <div className="featured-nft">
            <p>NFT EM DESTAQUE</p>
            <h2>OFERTA LIMITADA</h2>
            <Link
              to="/nfts/$nftId"
              params={{ nftId: "nft-002" }}
              search={{ ...search, edition: "", detailScenario: "default" }}
            >
              <img
                src="/images/sage-nomad.webp"
                alt="Sage Nomad em destaque"
                width="640"
                height="640"
                loading="lazy"
              />
              <span>
                Conheça Sage Nomad <ArrowRight size={14} />
              </span>
            </Link>
          </div>
        </aside>
        <div className="catalog-main">
          <h2 className="sr-only">NFTs disponíveis</h2>
          <div className="catalog-toolbar">
            <div
              className="catalog-tabs"
              role="group"
              aria-label="Seleção do catálogo"
            >
              {(
                [
                  ["all", "Todos os NFTs"],
                  ["new", "Novos lançamentos"],
                  ["trending", "Em alta"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={search.tab === value}
                  onClick={() => update({ tab: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="sort-label">
              Ordenar por
              <select
                aria-label="Ordenar NFTs"
                value={search.sort}
                onChange={(event) =>
                  update({ sort: event.target.value as CatalogSearch["sort"] })
                }
              >
                <option value="recent">Listados recentemente</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="name">Nome A–Z</option>
              </select>
            </label>
          </div>
          <div className="search-row">
            <form
              key={search.q}
              className="catalog-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                const value = new FormData(event.currentTarget).get("q");
                update({
                  q: String(value ?? "")
                    .trim()
                    .slice(0, 100),
                });
              }}
            >
              <label className="sr-only" htmlFor="catalog-search">
                Buscar NFTs
              </label>
              <Search size={18} aria-hidden="true" />
              <input
                id="catalog-search"
                name="q"
                defaultValue={search.q}
                placeholder="Encontre seu próximo NFT"
                maxLength={100}
              />
              <button type="submit" aria-label="Buscar">
                Buscar
              </button>
            </form>
            <Button
              variant="outline"
              className="filter-trigger"
              onClick={() => drawer.current?.showModal()}
            >
              <SlidersHorizontal size={16} /> Filtros
            </Button>
          </div>
          {hasFilters && (
            <div className="active-filters" aria-label="Filtros ativos">
              {search.q && (
                <button onClick={() => update({ q: "" })}>
                  Busca: {search.q}
                  <X size={12} />
                </button>
              )}
              {search.collections.map((value) => (
                <button
                  key={value}
                  onClick={() =>
                    update({
                      collections: search.collections.filter(
                        (item) => item !== value,
                      ),
                    })
                  }
                >
                  {collectionOptions.find(([id]) => id === value)?.[1]}
                  <X size={12} />
                </button>
              ))}
              {search.networks.map((value) => (
                <button
                  key={value}
                  onClick={() =>
                    update({
                      networks: search.networks.filter(
                        (item) => item !== value,
                      ),
                    })
                  }
                >
                  {value}
                  <X size={12} />
                </button>
              ))}
              {(search.minPrice || search.maxPrice) && (
                <button onClick={() => update({ minPrice: "", maxPrice: "" })}>
                  Preço: {search.minPrice || "0"} – {search.maxPrice || "∞"} ETH
                  <X size={12} />
                </button>
              )}
              <button
                className="clear-all"
                onClick={() =>
                  update({ ...defaultSearch, scenario: search.scenario })
                }
              >
                Limpar tudo
              </button>
            </div>
          )}
          <div className="results-status" role="status" aria-live="polite">
            {query.isPending
              ? "Carregando NFTs…"
              : query.isError
                ? "Não foi possível carregar os NFTs."
                : `${query.data.total} NFTs encontrados · Página ${search.page}${query.isFetching ? " · Atualizando…" : ""}`}
          </div>
          <div aria-busy={query.isFetching}>
            {query.isPending ? (
              <div
                className="nft-grid"
                aria-label="Carregando catálogo"
                data-testid="catalog-skeleton"
              >
                {Array.from({ length: 9 }, (_, index) => (
                  <div key={index} className="nft-skeleton" aria-hidden="true">
                    <div className="skeleton" />
                    <span className="skeleton" />
                    <span className="skeleton" />
                  </div>
                ))}
              </div>
            ) : query.isError ? (
              <div className="catalog-message" role="alert">
                <h2>Uma pausa inesperada.</h2>
                <p>
                  Não conseguimos carregar a coleção. Confira sua conexão e
                  tente novamente.
                </p>
                <Button
                  onClick={() => void query.refetch()}
                  disabled={query.isFetching}
                >
                  <RefreshCw size={15} /> Tentar novamente
                </Button>
              </div>
            ) : !query.data.items.length ? (
              <div className="catalog-message">
                <Search size={28} aria-hidden="true" />
                <h2>
                  {query.data.total
                    ? "Esta página não tem NFTs."
                    : "Nenhum NFT encontrado."}
                </h2>
                <p>
                  Experimente outra busca ou ajuste os filtros para descobrir
                  novas peças.
                </p>
                <Button
                  onClick={() =>
                    update(
                      query.data.total
                        ? { page: 1 }
                        : { ...defaultSearch, scenario: search.scenario },
                    )
                  }
                >
                  {query.data.total
                    ? "Ir para a primeira página"
                    : "Limpar busca e filtros"}
                </Button>
              </div>
            ) : (
              <div className="nft-grid">
                {query.data.items.map((nft, index) => (
                  <NftCard key={nft.id} nft={nft} search={search} priority={index < 2} />
                ))}
              </div>
            )}
          </div>
          {query.data && query.data.totalPages > 1 && (
            <nav className="pagination" aria-label="Paginação do catálogo">
              <button
                aria-label="Página anterior"
                disabled={search.page <= 1}
                onClick={() => update({ page: search.page - 1 })}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from(
                { length: query.data.totalPages },
                (_, index) => index + 1,
              ).map((page) => (
                <button
                  key={page}
                  aria-label={`Página ${page}`}
                  aria-current={page === search.page ? "page" : undefined}
                  onClick={() => update({ page })}
                >
                  {page}
                </button>
              ))}
              <button
                aria-label="Próxima página"
                disabled={search.page >= query.data.totalPages}
                onClick={() => update({ page: search.page + 1 })}
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </div>
      </section>
      <dialog
        ref={drawer}
        className="filter-dialog"
        aria-labelledby="filter-title"
      >
        <header>
          <h2 id="filter-title">Filtros do catálogo</h2>
          <form method="dialog">
            <button aria-label="Fechar filtros">
              <X size={20} />
            </button>
          </form>
        </header>
        <Filters
          search={search}
          facets={query.data?.facets}
          onChange={update}
        />
        <form method="dialog">
          <Button className="w-full">Ver resultados</Button>
        </form>
      </dialog>
      <section
        className="promo-grid page-width"
        aria-label="Explore as coleções"
      >
        <article>
          <img
            src="/images/emerald-ape.webp"
            alt=""
            width="640"
            height="640"
            loading="lazy"
          />
          <div>
            <h2>
              Lançamentos gênesis
              <br />
              de edição limitada
            </h2>
            <p>
              Colecione edições escassas diretamente dos criadores antes da
              revelação pública.
            </p>
            <Link
              to="/"
              search={{ ...defaultSearch, tab: "new" }}
              hash="catalogo"
            >
              Explorar <ArrowRight size={16} />
            </Link>
          </div>
        </article>
        <article>
          <img
            src="/images/ivory-baron.webp"
            alt=""
            width="640"
            height="640"
            loading="lazy"
          />
          <div>
            <h2>
              Arte digital selecionada
              <br />e muito mais
            </h2>
            <p>
              Explore novos artistas, coleções e obras digitais que definem a
              cultura.
            </p>
            <Link
              to="/"
              search={{ ...defaultSearch, collections: ["digital-art"] }}
              hash="catalogo"
            >
              Explorar <ArrowRight size={16} />
            </Link>
          </div>
        </article>
      </section>
      <Editorial />
    </>
  );
}
function Editorial() {
  const articles = [
    [
      "ivory-baron",
      "Como funciona a propriedade de NFTs",
      "Aprenda a colecionar, negociar e verificar ativos digitais.",
    ],
    [
      "emerald-ape",
      "10 artistas digitais para acompanhar",
      "Conheça criadores que moldam a cultura digital na rede.",
    ],
    [
      "sage-nomad",
      "Raridade, atributos e procedência",
      "Entenda raridade, procedência e direitos autorais.",
    ],
    [
      "golden-beat",
      "Como proteger sua carteira",
      "Proteja sua carteira e seus ativos digitais.",
    ],
  ];
  return (
    <section id="diario" className="editorial page-width">
      <h2>Diário da Cunhagem</h2>
      <p>
        Histórias, guias e insights para colecionadores sobre o universo da
        propriedade digital.
      </p>
      <div className="editorial-grid">
        {articles.map(([image, title, description], index) => (
          <article key={title}>
            <img
              src={`/images/${image}.webp`}
              alt=""
              width="640"
              height="640"
              loading="lazy"
            />
            <div>
              <p className="article-date">
                {12 + index} de setembro · Leitura de {index + 2} min
              </p>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="editorial-unavailable">
                Conteúdo editorial demonstrativo
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
