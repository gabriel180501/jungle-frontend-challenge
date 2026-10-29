import { useId, useState } from "react";
import type { CatalogResponse, CatalogSearch } from "./contracts";
import { collectionOptions, networks } from "./contracts";
import { Button } from "../../components/ui/button";
import { ethToWei, isEth } from "../../lib/eth";
interface Props {
  search: CatalogSearch;
  facets?: CatalogResponse["facets"];
  onChange: (patch: Partial<CatalogSearch>) => void;
}
export function Filters({ search, facets, onChange }: Props) {
  const id = useId();
  const [priceError, setPriceError] = useState("");
  return (
    <div className="filter-content">
      <fieldset>
        <legend>Coleções</legend>
        {collectionOptions.map(([value, label]) => (
          <label className="filter-option" key={value}>
            <input
              type="checkbox"
              checked={search.collections.includes(value)}
              onChange={(event) =>
                onChange({
                  collections: event.target.checked
                    ? [...search.collections, value]
                    : search.collections.filter((item) => item !== value),
                })
              }
            />
            <span>{label}</span>
            <span className="facet-count">
              {facets?.collections[value] ?? "—"}
            </span>
          </label>
        ))}
      </fieldset>
      <form
        onInput={() => setPriceError("")}
        key={`${search.minPrice}:${search.maxPrice}`}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const minPrice = String(form.get("min") ?? "")
            .trim()
            .replace(",", ".");
          const maxPrice = String(form.get("max") ?? "")
            .trim()
            .replace(",", ".");
          if (
            (minPrice && !isEth(minPrice)) ||
            (maxPrice && !isEth(maxPrice))
          ) {
            setPriceError("Use valores positivos com até 18 casas decimais.");
            return;
          }
          if (minPrice && maxPrice && ethToWei(minPrice) > ethToWei(maxPrice)) {
            setPriceError("O mínimo não pode ser maior que o máximo.");
            return;
          }
          setPriceError("");
          onChange({ minPrice, maxPrice });
        }}
        noValidate
      >
        <fieldset>
          <legend>Faixa de preço</legend>
          <div className="price-fields">
            <label htmlFor={`${id}-min`}>
              Mínimo (ETH)
              <input
                id={`${id}-min`}
                name="min"
                inputMode="decimal"
                defaultValue={search.minPrice}
                placeholder="0,00"
                aria-invalid={!!priceError}
                aria-describedby={priceError ? `${id}-error` : undefined}
              />
            </label>
            <label htmlFor={`${id}-max`}>
              Máximo (ETH)
              <input
                id={`${id}-max`}
                name="max"
                inputMode="decimal"
                defaultValue={search.maxPrice}
                placeholder="Sem limite"
                aria-invalid={!!priceError}
                aria-describedby={priceError ? `${id}-error` : undefined}
              />
            </label>
          </div>
          {priceError && (
            <p id={`${id}-error`} role="alert" className="field-error">
              {priceError}
            </p>
          )}
          <Button type="submit" className="mt-3">
            Aplicar preço
          </Button>
        </fieldset>
      </form>
      <fieldset>
        <legend>Rede</legend>
        {networks.map((value) => (
          <label key={value} className="filter-option">
            <input
              type="checkbox"
              checked={search.networks.includes(value)}
              onChange={(event) =>
                onChange({
                  networks: event.target.checked
                    ? [...search.networks, value]
                    : search.networks.filter((item) => item !== value),
                })
              }
            />
            <span>{value}</span>
            <span className="facet-count">
              {facets?.networks[value] ?? "—"}
            </span>
          </label>
        ))}
      </fieldset>
      <button
        className="text-link"
        onClick={() => {
          setPriceError("");
          onChange({
            collections: [],
            networks: [],
            minPrice: "",
            maxPrice: "",
          });
        }}
      >
        Limpar filtros
      </button>
    </div>
  );
}
