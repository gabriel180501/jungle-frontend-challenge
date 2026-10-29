import { parseCatalogSearch } from "../catalog/search";
import {
  detailScenarios,
  type DetailSearch,
  type DetailScenario,
} from "./contracts";
export function parseDetailSearch(
  input: Record<string, unknown>,
): DetailSearch {
  return {
    ...parseCatalogSearch(input),
    edition:
      typeof input.edition === "string" &&
      /^[a-z0-9-]{1,50}$/.test(input.edition)
        ? input.edition
        : "",
    detailScenario: detailScenarios.includes(
      input.detailScenario as DetailScenario,
    )
      ? (input.detailScenario as DetailScenario)
      : "default",
  };
}
