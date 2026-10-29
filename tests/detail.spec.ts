import { test, expect } from "@playwright/test";

const detailUrl = "/nfts/emerald-ape-042";

test("acesso direto, edição e refresh preservam o NFT selecionado", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(detailUrl);
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "1/50", exact: true }),
  ).toBeChecked();
  await expect(page.getByTestId("unit-price")).toHaveText("1,19 ETH");
  await page.getByRole("radio", { name: "1/1", exact: true }).check();
  await expect(page.getByTestId("unit-price")).toHaveText("3,57 ETH");
  expect(new URL(page.url()).searchParams.get("edition")).toBe("unique");
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "1/1", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Aumentar quantidade", exact: true }),
  ).toBeDisabled();
  await expect(page).toHaveTitle("Emerald Ape #042 — Kurio");
  expect(errors).toEqual([]);
});

test("quantidade respeita estoque e limite da edição; cálculo é preciso", async ({
  page,
}) => {
  await page.goto(detailUrl);
  const input = page.getByRole("spinbutton", { name: "Qtd." });
  await expect(input).toHaveValue("1");
  await expect(
    page.getByRole("button", { name: "Diminuir quantidade" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(input).toHaveValue("3");
  await expect(page.getByTestId("selection-total")).toHaveText("3,57 ETH");
  await expect(
    page.getByRole("button", { name: "Aumentar quantidade" }),
  ).toBeDisabled();
  for (const invalid of ["0", "1.5", "999", "-1", ""]) {
    await input.fill(invalid);
    await expect(page.getByRole("alert")).toContainText(
      "Escolha uma quantidade inteira entre 1 e 3.",
    );
    await expect(
      page.getByRole("button", { name: "Comprar NFT", exact: true }),
    ).toBeDisabled();
  }
  await input.fill("2");
  await expect(page.getByTestId("selection-total")).toHaveText("2,38 ETH");
  await page.getByRole("radio", { name: "ABERTA", exact: true }).check();
  await expect(input).toHaveValue("1");
  await expect(
    page.getByRole("status").filter({ hasText: "Limite de" }),
  ).toContainText("Limite de 5 por pedido.");
});

test("galeria alterna imagens, amplia e devolve foco ao fechar", async ({
  page,
}) => {
  await page.goto(detailUrl);
  await page
    .getByRole("button", { name: "Imagem 2: rosto", exact: true })
    .click();
  await expect(page.getByTestId("gallery-main")).toHaveClass(/view-face/);
  const zoom = page.getByRole("button", { name: "Ampliar imagem do NFT" });
  await zoom.click();
  const dialog = page.getByRole("dialog", {
    name: "Emerald Ape #042 · Imagem 2 de 4",
  });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog")).toHaveAccessibleName(
    "Emerald Ape #042 · Imagem 3 de 4",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(zoom).toBeFocused();
  await expect(page.getByTestId("gallery-main")).toHaveClass(/view-accessory/);
});

test("edição esgotada, edição desconhecida e NFT sem estoque bloqueiam compra", async ({
  page,
}) => {
  await page.goto(detailUrl + "?edition=limited-10");
  await expect(
    page.getByRole("radio", { name: "1/10 · esgotada", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: "Esta edição está esgotada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Esgotado", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "1/50", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Comprar NFT", exact: true }),
  ).toBeEnabled();
  await page.goto(detailUrl + "?edition=desconhecida");
  await expect(
    page.getByRole("status").filter({ hasText: "Edição não encontrada." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Comprar NFT", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "1/1", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Comprar NFT", exact: true }),
  ).toBeEnabled();
  await page.goto("/nfts/nft-035");
  await expect(
    page.getByRole("status").filter({ hasText: "NFT esgotado." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Esgotado", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("spinbutton", { name: "Qtd." })).toBeDisabled();
});

test("diferencia recurso inexistente de falha transitória e oferece recuperação", async ({
  page,
}) => {
  await page.goto("/nfts/inexistente");
  await expect(
    page.getByRole("heading", { name: "NFT não encontrado." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toHaveCount(0);
  await page.goto(detailUrl + "?detailScenario=error-once");
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível carregar este NFT.",
  );
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await page.goto(detailUrl + "?detailScenario=offline");
  await expect(page.getByRole("alert")).toContainText("Confira sua conexão");
});

test("carregamento lento mostra skeleton e respeita preferência de movimento", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(detailUrl + "?detailScenario=slow");
  const skeleton = page.getByTestId("detail-skeleton");
  await expect(skeleton).toBeVisible();
  expect(
    await skeleton
      .locator(".skeleton")
      .first()
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
});

test("abas funcionam por teclado e avaliações podem ser expandidas", async ({
  page,
}) => {
  await page.goto(detailUrl);
  const details = page.getByRole("tab", {
    name: "Detalhes do NFT",
    exact: true,
  });
  await details.focus();
  await page.keyboard.press("ArrowRight");
  const reviews = page.getByRole("tab", {
    name: "Avaliações de colecionadores (19)",
  });
  await expect(reviews).toBeFocused();
  await expect(reviews).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toContainText(
    "Exibindo 5 de 19 avaliações",
  );
  await page.getByRole("button", { name: "Mostrar mais avaliações" }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Exibindo 10 de 19 avaliações",
  );
  await details.click();
  await expect(page.getByRole("tabpanel")).toContainText("Nova Sato");
});

test("troca de NFT relacionado não mantém quantidade ou galeria da peça anterior", async ({
  page,
}) => {
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await page
    .getByRole("button", { name: "Imagem 3: acessórios", exact: true })
    .click();
  await page
    .getByRole("link", { name: /Sage Nomad #009/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sage Nomad #009", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Qtd." })).toHaveValue("1");
  await expect(page.getByTestId("gallery-main")).toHaveClass(/view-full/);
  await expect(page.getByTestId("unit-price")).toHaveText("1,69 ETH");
});

test("compra adiciona ao carrinho e favorito de visitante solicita login", async ({
  page,
}) => {
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Comprar NFT", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Carrinho de NFTs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("cart-row-emerald-ape-042:limited-50"),
  ).toBeVisible();
  await page.goto(detailUrl);
  await page
    .getByRole("button", { name: "Favoritar Emerald Ape #042", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
});

test("compartilhamento usa link direto com edição e não inclui a busca anterior", async ({
  page,
}) => {
  await page.goto(detailUrl + "?q=Emerald&edition=unique&detailScenario=slow");
  await page.getByRole("button", { name: "Compartilhar este NFT" }).click();
  const input = page.getByRole("textbox", { name: "Link para este NFT" });
  const url = new URL(await input.inputValue());
  expect(url.pathname).toBe(detailUrl);
  expect(url.searchParams.get("edition")).toBe("unique");
  expect(url.searchParams.has("q")).toBe(false);
  expect(url.searchParams.has("detailScenario")).toBe(false);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Compartilhar este NFT" }),
  ).toBeFocused();
});

test("detalhe não apresenta overflow horizontal", async ({ page }) => {
  await page.goto(detailUrl);
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("copia o link usando a área de transferência do navegador", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(detailUrl + "?edition=unique");
  await page.getByRole("button", { name: "Compartilhar este NFT" }).click();
  await page.getByRole("button", { name: "Copiar link", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
    "Link copiado.",
  );
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copied).searchParams.get("edition")).toBe("unique");
});
