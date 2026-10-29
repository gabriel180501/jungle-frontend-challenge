import { test, expect, type Page } from "@playwright/test";

async function filters(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) <= 820) {
    await page.getByRole("button", { name: "Filtros", exact: true }).click();
    return page.getByRole("dialog", { name: "Filtros do catálogo" });
  }
  return page.getByRole("complementary", { name: "Filtros do catálogo" });
}
async function closeFilters(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Filtros do catálogo" });
  if (await dialog.isVisible())
    await dialog.getByRole("button", { name: "Ver resultados" }).click();
}

test("combina busca, coleção, rede, preço e ordenação; persiste no refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
  await page.getByRole("textbox", { name: "Buscar NFTs" }).fill("Emerald");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const form = await filters(page);
  await form.getByRole("checkbox", { name: /^Arte digital/ }).check();
  await form.getByRole("checkbox", { name: /^Ethereum/ }).check();
  await form.getByLabel("Mínimo (ETH)").fill("1");
  await form.getByLabel("Máximo (ETH)").fill("2");
  await form.getByRole("button", { name: "Aplicar preço" }).click();
  await closeFilters(page);
  await page
    .getByRole("combobox", { name: "Ordenar NFTs" })
    .selectOption("price-desc");
  await expect(page.getByTestId("nft-card")).toHaveCount(2);
  await expect(page.getByTestId("nft-card").first()).toContainText(
    "Emerald Ape #609",
  );
  const url = new URL(page.url());
  expect(url.searchParams.get("q")).toBe("Emerald");
  expect(url.searchParams.get("sort")).toBe("price-desc");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Buscar NFTs" })).toHaveValue(
    "Emerald",
  );
  await expect(page.getByTestId("nft-card")).toHaveCount(2);
  await expect(
    page.getByRole("combobox", { name: "Ordenar NFTs" }),
  ).toHaveValue("price-desc");
});

test("paginação, mudança de filtro e histórico recuperam o estado correto", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Página 2", exact: true }).click();
  await expect(page.getByTestId("nft-card").first()).toContainText(
    "Emerald Ape #609",
  );
  const form = await filters(page);
  await form.getByRole("checkbox", { name: /^Fotografia/ }).check();
  await closeFilters(page);
  await expect(
    page.getByRole("status").filter({ hasText: /NFTs encontrados/ }),
  ).toContainText("Página 1");
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Página 2", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("nft-card").first()).toContainText(
    "Emerald Ape #609",
  );
  await page.goForward();
  await expect(
    page.getByRole("status").filter({ hasText: /NFTs encontrados/ }),
  ).toContainText("4 NFTs encontrados · Página 1");
});

test("skeleton, vazio e recuperação de erro usam handlers MSW", async ({
  page,
}) => {
  await page.goto("/?scenario=slow#catalogo");
  await expect(page.getByTestId("catalog-skeleton")).toBeVisible();
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
  await page.goto("/?q=inexistente#catalogo");
  await expect(
    page.getByRole("heading", { name: "Nenhum NFT encontrado." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpar busca e filtros" }).click();
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
  await page.goto("/?scenario=error-once#catalogo");
  await expect(page.getByRole("alert")).toContainText("Uma pausa inesperada.");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
});

test("uma busca antiga e lenta não sobrescreve a mais recente", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/?scenario=out-of-order#catalogo");
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
  const search = page.getByRole("textbox", { name: "Buscar NFTs" });
  await search.fill("Sage");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByTestId("catalog-skeleton")).toBeVisible();
  await search.fill("Golden");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
  await expect(page.getByTestId("nft-card").first()).toContainText(
    "Golden Beat",
  );
  // Aguarda a janela da resposta antiga e confirma que ela não substituiu os dados atuais.
  await page.clock.runFor(1600);
  await expect(page.getByTestId("nft-card").first()).toContainText(
    "Golden Beat",
  );
  expect(new URL(page.url()).searchParams.get("q")).toBe("Golden");
});

test("navega ao NFT selecionado e retorna mantendo a busca", async ({
  page,
}) => {
  await page.goto("/?q=Emerald#catalogo");
  await page
    .getByRole("link", { name: /Emerald Ape #042/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao catálogo" }).click();
  await expect(page.getByRole("textbox", { name: "Buscar NFTs" })).toHaveValue(
    "Emerald",
  );
  await expect(page.getByTestId("nft-card")).toHaveCount(4);
});

test("abas, ordenação e página fora do intervalo", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Novos lançamentos", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /NFTs encontrados/ }),
  ).toContainText("12 NFTs encontrados");
  await page.getByRole("button", { name: "Em alta", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /NFTs encontrados/ }),
  ).toContainText("18 NFTs encontrados");
  await page
    .getByRole("combobox", { name: "Ordenar NFTs" })
    .selectOption("price-asc");
  await expect(page.getByTestId("nft-card").first()).toContainText(
    "Golden Signal #160",
  );
  await page.goto("/?page=999#catalogo");
  await expect(
    page.getByRole("heading", { name: "Esta página não tem NFTs." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ir para a primeira página" }).click();
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
});

test("filtro de preço valida limites e permite limpar", async ({ page }) => {
  await page.goto("/");
  const form = await filters(page);
  await form.getByLabel("Mínimo (ETH)").fill("5");
  await form.getByLabel("Máximo (ETH)").fill("1");
  await form.getByRole("button", { name: "Aplicar preço" }).click();
  await expect(form.getByRole("alert")).toContainText(
    "O mínimo não pode ser maior que o máximo.",
  );
  await form.getByLabel("Mínimo (ETH)").fill("0.390000000000000001");
  await form.getByLabel("Máximo (ETH)").fill("0.99");
  await form.getByRole("button", { name: "Aplicar preço" }).click();
  await closeFilters(page);
  await expect(page.getByTestId("nft-card")).toHaveCount(2);
  await expect(
    page.getByTestId("nft-card").filter({ hasText: "Golden Signal" }),
  ).toHaveCount(0);
});

test("layout não apresenta overflow e diálogo respeita Escape e foco", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if ((page.viewportSize()?.width ?? 1440) <= 820) {
    const trigger = page.getByRole("button", { name: "Filtros", exact: true });
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Filtros do catálogo" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Filtros do catálogo" }),
    ).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
});

test("falha de conexão apresenta recuperação e pode trocar de cenário", async ({
  page,
}) => {
  await page.goto("/?scenario=offline#catalogo");
  await expect(page.getByRole("alert")).toContainText("Uma pausa inesperada.");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.goto("/?scenario=default#catalogo");
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
});
