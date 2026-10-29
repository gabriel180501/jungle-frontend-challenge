import { test, expect, type Page } from "@playwright/test";
const nftId = "emerald-ape-042";
async function json(page: Page, url: string, method = "GET", body?: unknown) {
  return page.evaluate(
    async ({ url, method, body }) => {
      const response = await fetch(`/api${url}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        data: response.status === 204 ? null : await response.json(),
      };
    },
    { url, method, body },
  );
}
async function add(
  page: Page,
  edition = "limited-50",
  quantity = 1,
  id = nftId,
) {
  await page.goto(`/nfts/${id}?edition=${edition}`);
  await page.getByLabel("Qtd.", { exact: true }).fill(String(quantity));
  await page.getByRole("button", { name: "Comprar NFT", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Carrinho de NFTs", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId(`cart-row-${id}:${edition}`)).toBeVisible();
  await expect(page.getByTestId("cart-total")).toBeVisible();
}
async function login(page: Page, email = "gabriel@kurio.test") {
  await page.goto("/login?redirect=/cart");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("GoldoBotafogo18*");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Carrinho de NFTs", exact: true }),
  ).toBeVisible();
}
const row = (page: Page, edition = "limited-50") =>
  page.getByTestId(`cart-row-${nftId}:${edition}`);
test("visitante adiciona edições separadas, altera quantidade, persiste e remove", async ({
  page,
}) => {
  await add(page);
  await add(page, "open", 2);
  await expect(page.getByRole("article", { name: /Emerald Ape/ })).toHaveCount(
    2,
  );
  await row(page)
    .getByRole("button", { name: /Aumentar/ })
    .click();
  await expect(row(page).getByRole("spinbutton")).toHaveValue("2");
  await page.reload();
  await expect(row(page).getByRole("spinbutton")).toHaveValue("2");
  await expect(row(page, "open").getByRole("spinbutton")).toHaveValue("2");
  await row(page, "open")
    .getByRole("button", { name: /Remover/ })
    .click();
  await expect(row(page, "open")).toHaveCount(0);
  await row(page)
    .getByRole("button", { name: /Remover/ })
    .click();
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: true }),
  ).toBeVisible();
});
test("API rejeita quantidade fracionária, edição inexistente e estoque excedido", async ({
  page,
}) => {
  await add(page);
  const cart = (await json(page, "/cart")).data;
  for (const [values, status] of [
    [{ quantity: 1.5 }, 422],
    [{ quantity: 4 }, 409],
    [{ editionId: "inexistente" }, 404],
  ] as const) {
    const result = await json(page, "/cart/items", "PUT", {
      nftId,
      editionId: "limited-50",
      quantity: 1,
      version: cart.version,
      ...values,
    });
    expect(result.status).toBe(status);
  }
  await page.reload();
  await expect(row(page).getByRole("spinbutton")).toHaveValue("1");
});
test("cupom válido calcula valores exatos, persiste e pode ser removido", async ({
  page,
}) => {
  await add(page, "limited-50", 2);
  await expect(page.getByTestId("cart-subtotal")).toHaveText("2,38 ETH");
  await page.getByLabel("Código promocional", { exact: true }).fill("kurio10");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.getByTestId("cart-discount")).toHaveText("− 0,238 ETH");
  await expect(page.getByTestId("cart-total")).toHaveText("2,158 ETH");
  await page.reload();
  await expect(page.getByTestId("cart-total")).toHaveText("2,158 ETH");
  await page
    .getByRole("button", { name: "Remover cupom", exact: true })
    .click();
  await expect(page.getByTestId("cart-total")).toHaveText("2,396 ETH");
});
test("cupom inválido ou expirado mantém o carrinho e permite recuperação", async ({
  page,
}) => {
  await add(page);
  for (const [code, message] of [
    ["ERRADO", "Código promocional inválido."],
    ["EXPIRADO", "Este cupom expirou."],
  ]) {
    await page.getByLabel("Código promocional", { exact: true }).fill(code);
    await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: message }),
    ).toBeVisible();
  }
  await page.getByLabel("Código promocional", { exact: true }).fill("KURIO10");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await expect(page.getByTestId("cart-total")).toHaveText("1,087 ETH");
});
test("login preserva carrinho visitante e une com itens anteriores da conta", async ({
  page,
}) => {
  await add(page, "limited-50", 1);
  await login(page);
  await expect(row(page).getByRole("spinbutton")).toHaveValue("1");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^(Sair|Saindo…)$/ }),
  ).not.toBeVisible();
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: true }),
  ).toBeVisible();
  await add(page, "limited-50", 3);
  await login(page);
  await expect(row(page).getByRole("spinbutton")).toHaveValue("3");
  await expect(page.getByText(/união dos carrinhos ajustou/)).toBeVisible();
  await page.reload();
  await expect(row(page).getByRole("spinbutton")).toHaveValue("3");
});
test("carrinhos de contas distintas não se misturam no logout", async ({
  page,
}) => {
  await add(page);
  await login(page);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^(Sair|Saindo…)$/ }),
  ).not.toBeVisible();
  await login(page, "mario@kurio.test");
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^(Sair|Saindo…)$/ }),
  ).not.toBeVisible();
  await login(page);
  await expect(row(page)).toBeVisible();
});
test("falha de alteração mantém itens e a tentativa seguinte funciona", async ({
  page,
}) => {
  await add(page);
  await json(page, "/demo/cart/scenario", "POST", { mode: "fail-once" });
  await row(page)
    .getByRole("button", { name: /Aumentar/ })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: /Não foi possível salvar/ }),
  ).toBeVisible();
  await expect(row(page).getByRole("spinbutton")).toHaveValue("1");
  await row(page)
    .getByRole("button", { name: /Aumentar/ })
    .click();
  await expect(row(page).getByRole("spinbutton")).toHaveValue("2");
});
test("mudança de preço atualiza cotação e exige revisão dos valores", async ({
  page,
}) => {
  await add(page);
  await expect(page.getByTestId("cart-total")).toHaveText("1,206 ETH");
  await json(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    price: "1.123456789123456789",
  });
  await expect(page.getByTestId("cart-total")).toHaveText(
    "1,139456789123456789 ETH",
  );
  await expect(
    page.getByRole("button", { name: "Entrar e continuar" }),
  ).toBeDisabled();
  await page.getByLabel("Conferi os itens e valores atualizados").check();
  await expect(
    page.getByRole("button", { name: "Entrar e continuar" }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.getByTestId("cart-total")).toHaveText(
    "1,139456789123456789 ETH",
  );
  const catalog = await json(page, "/nfts?q=Emerald");
  expect(
    catalog.data.items.find((item: { id: string }) => item.id === nftId).price,
  ).toBe("1.123456789123456789");
  const detail = await json(page, "/nfts/nft-002");
  expect(
    detail.data.related.find((item: { id: string }) => item.id === nftId).price,
  ).toBe("1.123456789123456789");
  await page.goto("/nfts/emerald-ape-042");
  await expect(page.getByTestId("unit-price")).toHaveText(
    "1,123456789123456789 ETH",
  );
});
test("queda de estoque bloqueia continuar e deixa ajustar ou remover", async ({
  page,
}) => {
  await add(page, "limited-50", 3);
  await json(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    available: 1,
  });
  await expect(row(page).getByText(/Disponibilidade alterada/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entrar e continuar" }),
  ).toBeDisabled();
  await row(page).getByRole("spinbutton").fill("1");
  await row(page).getByRole("spinbutton").press("Enter");
  await expect(row(page).getByRole("spinbutton")).toHaveValue("1");
  await expect(row(page).getByText(/Disponibilidade alterada/)).toHaveCount(0);
  await json(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    available: 0,
  });
  await expect(
    row(page).getByText(/Esta edição está indisponível/),
  ).toBeVisible();
  await row(page)
    .getByRole("button", { name: /Remover/ })
    .click();
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: true }),
  ).toBeVisible();
});
test("versão antiga não sobrescreve alterações e reset restaura todo o cenário", async ({
  page,
}) => {
  await add(page);
  const old = (await json(page, "/cart")).data;
  expect(
    (
      await json(page, "/cart/items", "PUT", {
        nftId,
        editionId: "limited-50",
        quantity: 2,
        version: old.version,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await json(page, "/cart/items", "DELETE", {
        nftId,
        editionId: "limited-50",
        version: old.version,
      })
    ).status,
  ).toBe(409);
  await json(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    price: "9",
  });
  await page.goto("/diagnostico");
  await page
    .getByRole("button", { name: "Restaurar cenário inicial", exact: true })
    .click();
  await expect(
    page.getByText("Cenário inicial restaurado.", { exact: true }),
  ).toBeVisible();
  await page.goto("/cart");
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: true }),
  ).toBeVisible();
  await page.goto("/nfts/emerald-ape-042");
  await expect(page.getByTestId("unit-price")).toHaveText("1,19 ETH");
});
test("continuar exige login e retoma o carrinho antes do pagamento", async ({
  page,
}) => {
  await add(page);
  await page.getByRole("button", { name: "Entrar e continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page.getByLabel("E-mail", { exact: true }).fill("gabriel@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill("GoldoBotafogo18*");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(row(page)).toBeVisible();
  await page.getByRole("button", { name: "Continuar para pagamento" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
});
test("carrinho é responsivo e quantidade inválida tem mensagem associada", async ({
  page,
}) => {
  await add(page);
  const input = row(page).getByRole("spinbutton");
  await input.fill("1.5");
  await input.press("Enter");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(row(page).getByRole("alert")).toContainText(
    "quantidade inteira",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("carrinho aberto recebe mudanças de outra aba", async ({
  page,
  context,
}) => {
  await add(page);
  const other = await context.newPage();
  await other.goto("/cart");
  await expect(row(other)).toBeVisible();
  await row(other)
    .getByRole("button", { name: /Aumentar/ })
    .click();
  await expect(row(page).getByRole("spinbutton")).toHaveValue("2");
  await row(other)
    .getByRole("button", { name: /Remover/ })
    .click();
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: true }),
  ).toBeVisible();
});
test("falha de rede na cotação bloqueia avanço e permite recálculo sem perder itens", async ({
  page,
}) => {
  await add(page);
  await json(page, "/demo/cart/scenario", "POST", { mode: "offline" });
  await row(page)
    .getByRole("button", { name: /Aumentar/ })
    .click();
  await expect(
    page.getByText("Não foi possível atualizar o carrinho.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entrar e continuar" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Não foi possível atualizar a cotação.", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await json(page, "/demo/cart/scenario", "POST", { mode: "default" });
  await page
    .getByRole("button", { name: "Recalcular cotação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(row(page)).toBeVisible();
  await expect(page.getByTestId("cart-total")).toHaveText("1,206 ETH");
});
test("requisição lenta do visitante não salva no carrinho de quem acabou de entrar", async ({
  page,
  context,
}) => {
  await add(page);
  const gate = (
    await json(page, "/demo/cart/scenario", "POST", { mode: "hold" })
  ).data;
  const cart = (await json(page, "/cart")).data;
  const other = await context.newPage();
  await other.goto("/login?redirect=/cart");
  await other.getByLabel("E-mail", { exact: true }).fill("gabriel@kurio.test");
  await other.getByLabel("Senha", { exact: true }).fill("GoldoBotafogo18*");
  const pending = page.evaluate(async (version: number) => {
    const response = await fetch("/api/cart/items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nftId: "emerald-ape-042",
        editionId: "limited-50",
        quantity: 3,
        version,
      }),
    });
    return response.status;
  }, cart.version);
  await page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/cart/items") && request.method() === "PUT",
  );
  await expect
    .poll(
      async () =>
        (await json(other, `/demo/cart/hold/${gate.gateId}`)).data.state,
    )
    .toBe("held");
  await other.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    other.getByRole("heading", { name: "Carrinho de NFTs", exact: true }),
  ).toBeVisible();
  await expect(row(other).getByRole("spinbutton")).toHaveValue("1");
  await json(other, "/demo/cart/release", "POST", { gateId: gate.gateId });
  expect(await pending).toBe(409);
  await expect(row(other).getByRole("spinbutton")).toHaveValue("1");
});
test("cotação soma taxa por rede usando strings ETH e sem arredondar centésimos", async ({
  page,
}) => {
  await add(page);
  await add(page, "unique", 1, "nft-002");
  await expect(page.getByTestId("cart-subtotal")).toHaveText("2,88 ETH");
  await expect(page.getByTestId("cart-fee")).toHaveText("0,032 ETH");
  await expect(page.getByTestId("cart-total")).toHaveText("2,912 ETH");
});
