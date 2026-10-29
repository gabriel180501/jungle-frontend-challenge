import { expect, test, type Page } from "@playwright/test";
const nftId = "emerald-ape-042";
const collector = {
  displayName: "Gabriel",
  username: "gabriel_usuario",
  profileName: "gabriel_usuario",
  referralCode: "KURIO2026",
  email: "gabriel@kurio.test",
  ens: "",
  secondaryReference: "",
  note: "",
};
async function call(
  page: Page,
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return page.evaluate(
    async ({ path, method, body, headers }) => {
      const response = await fetch(`/api${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        data: response.status === 204 ? null : await response.json(),
      };
    },
    { path, method, body, headers },
  );
}
async function setup(page: Page, quantity = 1) {
  await page.goto("/login?redirect=/cart");
  await page.getByLabel("E-mail", { exact: true }).fill("gabriel@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill("GoldoBotafogo18*");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Carrinho de NFTs", exact: true }),
  ).toBeVisible();
  const result = await call(page, "/wallets", "POST", {
    role: "primary",
    displayName: "Gabriel",
    nickname: "Principal",
    profileName: "gabriel_usuario",
    referralCode: "KURIO2026",
    email: "gabriel@kurio.test",
    ens: "",
    secondaryReference: "",
    network: "Ethereum",
    address: "0x" + "1".repeat(40),
    walletType: "MetaMask",
  });
  expect(result.status).toBe(201);
  const cart = (await call(page, "/cart")).data;
  expect(
    (
      await call(page, "/cart/items", "POST", {
        nftId,
        editionId: "limited-50",
        quantity,
        version: cart.version,
      })
    ).status,
  ).toBe(200);
  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", { name: "Perfil do colecionador", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("checkout-total")).toBeVisible();
  return result.data;
}
async function prepare(page: Page) {
  await page
    .getByRole("button", { name: "Conectar carteira simulada", exact: true })
    .click();
  await expect(
    page.getByText("Carteira conectada (simulação).", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revisar compra", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Revise antes de confirmar",
      exact: true,
    }),
  ).toBeVisible();
}
async function confirm(page: Page) {
  await page
    .getByLabel("Conferi os dados, itens e valores desta compra simulada")
    .check();
  await page
    .getByRole("button", { name: "Confirmar compra simulada", exact: true })
    .click();
  await expect(page).toHaveURL(/\/orders\/[^/?]+$/);
}
async function apiReview(page: Page, walletId: string) {
  const connection = await call(page, "/wallet-connections", "POST", {
    walletId,
    network: "Ethereum",
  });
  expect(connection.status).toBe(201);
  const review = await call(page, "/checkout/review", "POST", {
    collector,
    connectionId: connection.data.id,
  });
  expect(review.status).toBe(201);
  return review.data;
}
async function send(page: Page, reviewId: string, key = crypto.randomUUID()) {
  return call(
    page,
    "/orders",
    "POST",
    { reviewId },
    { "Idempotency-Key": key },
  );
}

test("pagamento revisa dados, confirma e mostra recibo apenas após confirmação", async ({
  page,
}) => {
  await setup(page, 2);
  await prepare(page);
  await expect(
    page.getByRole("button", { name: "Confirmar compra simulada" }),
  ).toBeDisabled();
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("checkout-total")).toHaveText("2,396 ETH");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ver referência simulada" }).click();
  await expect(
    page.getByRole("dialog", { name: "Explorador simulado" }),
  ).toContainText("não corresponde a uma transação");
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page
    .getByRole("link", { name: "Voltar ao carrinho", exact: true })
    .click();
  await expect(
    page.getByText("Seu carrinho está vazio.", { exact: true }),
  ).toBeVisible();
});

test("formulário valida campos e API devolve erros associados", async ({
  page,
}) => {
  const wallet = await setup(page);
  await page
    .getByRole("button", { name: "Conectar carteira simulada" })
    .click();
  await expect(
    page.getByText("Carteira conectada (simulação).", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("E-mail", { exact: true }).fill("invalido");
  await page.getByLabel("Nome de exibição", { exact: true }).fill("");
  await page.getByRole("button", { name: "Revisar compra" }).click();
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Revise antes de confirmar" }),
  ).toHaveCount(0);
  const connection = (
    await call(page, "/wallet-connections", "POST", {
      walletId: wallet.id,
      network: "Ethereum",
    })
  ).data;
  const response = await call(page, "/checkout/review", "POST", {
    connectionId: connection.id,
    collector: { ...collector, email: "erro" },
  });
  expect(response.status).toBe(422);
  expect(response.data.fields.email).toBeTruthy();
});

test("carteira recusa conexão e permite tentar novamente", async ({ page }) => {
  await setup(page);
  await call(page, "/demo/orders/scenario", "POST", { wallet: "refuse" });
  await page
    .getByRole("button", { name: "Conectar carteira simulada" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: /Conexão recusada/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Revisar compra" }),
  ).toBeDisabled();
  await call(page, "/demo/orders/scenario", "POST", { wallet: "connect" });
  await prepare(page);
});

test("desconectar invalida revisão e rede incompatível bloqueia conexão", async ({
  page,
}) => {
  await setup(page);
  await prepare(page);
  await page.getByRole("button", { name: "Desconectar carteira" }).click();
  await expect(
    page.getByRole("heading", { name: "Revise antes de confirmar" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Revisar compra" }),
  ).toBeDisabled();
  await page.getByLabel("Rede", { exact: true }).selectOption("Polygon");
  await expect(
    page.getByRole("alert").filter({ hasText: /rede deve corresponder/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conectar carteira simulada" }),
  ).toBeDisabled();
});

test("desconexão recebida após conectar bloqueia confirmação", async ({
  page,
}) => {
  await setup(page);
  await call(page, "/demo/orders/scenario", "POST", { wallet: "disconnect" });
  await prepare(page);
  await expect(
    page.getByText("A carteira foi desconectada ou expirou.", { exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("button", { name: "Confirmar compra simulada" }),
  ).toBeDisabled();
});

for (const change of ["preço", "estoque", "taxa", "cupom"] as const) {
  test(`API revalida ${change} e exige nova revisão sem criar pedido`, async ({
    page,
  }) => {
    const wallet = await setup(page, 2);
    if (change === "cupom") {
      const cart = (await call(page, "/cart")).data;
      await call(page, "/cart/coupon", "PUT", {
        coupon: "KURIO10",
        version: cart.version,
      });
    }
    const review = await apiReview(page, wallet.id);
    if (change === "preço")
      await call(page, "/demo/market", "POST", {
        nftId,
        editionId: "limited-50",
        price: "2",
      });
    if (change === "estoque")
      await call(page, "/demo/market", "POST", {
        nftId,
        editionId: "limited-50",
        available: 1,
      });
    if (change === "taxa")
      await call(page, "/demo/pricing", "POST", {
        networkFee: "0.03",
        couponExpired: false,
      });
    if (change === "cupom")
      await call(page, "/demo/pricing", "POST", {
        networkFee: "0.016",
        couponExpired: true,
      });
    const response = await send(page, review.id);
    expect(response.status).toBe(409);
    expect(response.data.code).toBe("QUOTE_CHANGED");
    expect((await call(page, "/orders")).data.items).toHaveLength(0);
    expect((await call(page, "/cart")).data.items[0].quantity).toBe(2);
  });
}

test("mudança na cotação bloqueia confirmação na interface até nova revisão", async ({
  page,
}) => {
  await setup(page);
  await prepare(page);
  await page
    .getByLabel("Conferi os dados, itens e valores desta compra simulada")
    .check();
  await call(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    price: "1.5",
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /cotação mudou/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar compra simulada" }),
  ).toBeDisabled();
  const comparison = page.getByTestId("quote-comparison");
  await expect(comparison).toBeVisible();
  await expect(comparison.getByTestId(`quote-price-${nftId}:limited-50`).locator("td .quote-value")).toHaveText([
    "1,19 ETH", "1,50 ETH", "+0,31 ETH",
  ]);
  await expect(comparison.getByTestId("quote-network-fee").locator("td .quote-value")).toHaveText([
    "0,016 ETH", "0,016 ETH", "Sem alteração",
  ]);
  await expect(comparison.getByTestId("quote-total").locator("td .quote-value")).toHaveText([
    "1,206 ETH", "1,516 ETH", "+0,31 ETH",
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole("button", { name: "Revisar compra", exact: true })
    .click();
  await expect(comparison).toHaveCount(0);
  await expect(
    page.getByText("Total revisado:", { exact: false }),
  ).toContainText("1,516 ETH");
  await expect(
    page.getByLabel("Conferi os dados, itens e valores desta compra simulada"),
  ).not.toBeChecked();
});

test("comparativo preserva um wei e mostra redução em relação à última revisão", async ({ page }) => {
  await setup(page, 2);
  await prepare(page);
  await call(page, "/demo/market", "POST", { nftId, editionId: "limited-50", price: "1.190000000000000001" });
  const comparison = page.getByTestId("quote-comparison");
  await expect(comparison.getByTestId(`quote-price-${nftId}:limited-50`).locator("td .quote-value")).toHaveText([
    "1,19 ETH", "1,190000000000000001 ETH", "+0,000000000000000001 ETH",
  ]);
  await expect(comparison.getByTestId(`quote-items-total-${nftId}:limited-50`).locator("td .quote-value")).toHaveText([
    "2,38 ETH", "2,380000000000000002 ETH", "+0,000000000000000002 ETH",
  ]);
  await call(page, "/demo/market", "POST", { nftId, editionId: "limited-50", price: "1.18" });
  await expect(comparison.getByTestId(`quote-price-${nftId}:limited-50`).locator("td .quote-value")).toHaveText([
    "1,19 ETH", "1,18 ETH", "−0,01 ETH",
  ]);
  await expect(comparison.getByTestId("quote-total").locator("td .quote-value")).toHaveText([
    "2,396 ETH", "2,376 ETH", "−0,02 ETH",
  ]);
});

test("comparativo identifica taxa alterada sem atribuir mudança ao preço do NFT", async ({ page }) => {
  await setup(page);
  await prepare(page);
  await call(page, "/demo/pricing", "POST", { networkFee: "0.02", couponExpired: false });
  const comparison = page.getByTestId("quote-comparison");
  await expect(comparison.getByTestId("quote-network-fee").locator("td .quote-value")).toHaveText([
    "0,016 ETH", "0,02 ETH", "+0,004 ETH",
  ]);
  await expect(comparison.getByTestId(`quote-price-${nftId}:limited-50`)).toHaveCount(0);
  await expect(comparison.getByTestId("quote-subtotal").locator("td .quote-value")).toHaveText([
    "1,19 ETH", "1,19 ETH", "Sem alteração",
  ]);
});

test("comparativo explica desconto perdido quando o cupom expira", async ({ page }) => {
  await setup(page);
  const cart = (await call(page, "/cart")).data;
  expect((await call(page, "/cart/coupon", "PUT", { coupon: "KURIO10", version: cart.version })).status).toBe(200);
  await page.reload();
  await expect(page.getByTestId("checkout-total")).toHaveText("1,087 ETH");
  await prepare(page);
  await page.getByLabel("Conferi os dados, itens e valores desta compra simulada").check();
  await call(page, "/demo/pricing", "POST", { networkFee: "0.016", couponExpired: true });
  const comparison = page.getByTestId("quote-comparison");
  await expect(comparison.getByTestId("quote-discount").locator("td .quote-value")).toHaveText([
    "0,119 ETH", "0,00 ETH", "−0,119 ETH",
  ]);
  await expect(comparison.getByTestId("quote-total").locator("td .quote-value")).toHaveText([
    "1,087 ETH", "1,206 ETH", "+0,119 ETH",
  ]);
  await expect(comparison.getByTestId("quote-coupon")).toContainText("Este cupom expirou.");
  await expect(page.getByRole("button", { name: "Confirmar compra simulada" })).toBeDisabled();
});

test("comparativo mostra estoque reduzido mesmo sem mudança no valor", async ({ page }) => {
  await setup(page);
  await prepare(page);
  await page.getByLabel("Conferi os dados, itens e valores desta compra simulada").check();
  const available = (await call(page, "/cart")).data.items[0].available;
  await call(page, "/demo/market", "POST", { nftId, editionId: "limited-50", available: 0 });
  const comparison = page.getByTestId("quote-comparison");
  await expect(comparison.getByTestId(`quote-availability-${nftId}:limited-50`).locator("td .quote-value")).toHaveText([
    String(available), "0", `−${available}`,
  ]);
  await expect(comparison.getByTestId("quote-total").locator("td .quote-value")).toHaveText([
    "1,206 ETH", "1,206 ETH", "Sem alteração",
  ]);
  await expect(page.getByRole("button", { name: "Confirmar compra simulada" })).toBeDisabled();
});

test("comparativo distingue revisão vencida de uma mudança de cotação", async ({ page }) => {
  await setup(page);
  await page.clock.install();
  await prepare(page);
  await page.getByLabel("Conferi os dados, itens e valores desta compra simulada").check();
  await page.clock.fastForward(61000);
  await expect(page.getByRole("alert").filter({ hasText: /A revisão expirou/ })).toContainText("mas os valores não mudaram");
  await expect(page.getByTestId("quote-comparison")).toHaveCount(0);
  await expect(page.getByRole("alert").filter({ hasText: /A cotação mudou/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirmar compra simulada" })).toBeDisabled();
  await page.getByRole("button", { name: "Revisar compra", exact: true }).click();
  await expect(page.getByLabel("Conferi os dados, itens e valores desta compra simulada")).not.toBeChecked();
  await expect(page.getByRole("alert").filter({ hasText: /A revisão expirou/ })).toHaveCount(0);
});

test("comparativo separa quantidade alterada de preço por unidade", async ({ page }) => {
  await setup(page);
  await prepare(page);
  const cart = (await call(page, "/cart")).data;
  expect((await call(page, "/cart/items", "PUT", { nftId, editionId: "limited-50", quantity: 2, version: cart.version })).status).toBe(200);
  const comparison = page.getByTestId("quote-comparison");
  await expect(comparison.getByTestId(`quote-quantity-${nftId}:limited-50`).locator("td .quote-value")).toHaveText(["1", "2", "+1"]);
  await expect(comparison.getByTestId(`quote-price-${nftId}:limited-50`)).toHaveCount(0);
  await expect(comparison.getByTestId("quote-total").locator("td .quote-value")).toHaveText(["1,206 ETH", "2,396 ETH", "+1,19 ETH"]);
});

test("comparativo identifica itens adicionados e removidos durante a revisão", async ({ page }) => {
  await setup(page);
  await prepare(page);
  const cart = (await call(page, "/cart")).data;
  expect((await call(page, "/cart/items", "POST", { nftId: "nft-004", editionId: "limited-50", quantity: 1, version: cart.version })).status).toBe(200);
  const comparison = page.getByTestId("quote-comparison");
  await expect(comparison.getByTestId("quote-item-nft-004:limited-50")).toContainText("Adicionado");
  const updated = (await call(page, "/cart")).data;
  expect((await call(page, "/cart/items", "DELETE", { nftId, editionId: "limited-50", version: updated.version })).status).toBe(200);
  await expect(comparison.getByTestId(`quote-item-${nftId}:limited-50`)).toContainText("Removido");
  await expect(page.getByRole("button", { name: "Confirmar compra simulada" })).toBeDisabled();
});

test("chave de idempotência recupera mesmo pedido e recusa conteúdo diferente", async ({
  page,
}) => {
  const wallet = await setup(page);
  await call(page, "/demo/orders/scenario", "POST", { order: "pending" });
  const review = await apiReview(page, wallet.id),
    key = crypto.randomUUID();
  const results = await Promise.all([
    send(page, review.id, key),
    send(page, review.id, key),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
  expect(results[0].data.id).toBe(results[1].data.id);
  expect((await send(page, "outra-revisao", key)).status).toBe(409);
  expect((await call(page, "/orders")).data.items).toHaveLength(1);
  const live = (await call(page, `/nfts/${nftId}`)).data;
  expect(
    live.editions.find((e: { id: string }) => e.id === "limited-50").available,
  ).toBe(4);
});

test("timeout após aceitar é recuperado sem duplicar pedido", async ({
  page,
}) => {
  await setup(page);
  await call(page, "/demo/orders/scenario", "POST", {
    order: "timeout-confirm",
  });
  await prepare(page);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  expect((await call(page, "/orders")).data.items).toHaveLength(1);
});

test("pedido pendente sobrevive a refresh e falha de consulta sem exibir confirmação", async ({
  page,
}) => {
  const wallet = await setup(page);
  await call(page, "/demo/orders/scenario", "POST", { order: "pending" });
  const review = await apiReview(page, wallet.id),
    order = (await send(page, review.id)).data;
  await page.goto(`/orders/${order.id}`);
  await expect(
    page.getByRole("heading", { name: "Pedido em processamento", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Pedido em processamento", exact: true }),
  ).toBeVisible();
  await call(page, "/demo/orders/scenario", "POST", { order: "offline" });
  await page
    .getByRole("button", { name: "Consultar estado", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Não foi possível consultar o pedido",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toHaveCount(0);
  await call(page, "/demo/orders/scenario", "POST", { order: "pending" });
  await page
    .getByRole("button", { name: "Consultar novamente", exact: true })
    .click();
  await call(page, `/demo/orders/${order.id}/resolve`, "POST", {
    status: "confirmed",
  });
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toBeVisible();
});

test("recusa preserva itens e libera estoque reservado", async ({ page }) => {
  await setup(page);
  await call(page, "/demo/orders/scenario", "POST", { order: "reject" });
  await prepare(page);
  await confirm(page);
  await expect(
    page.getByRole("heading", { name: "Compra recusada", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading", { name: /agora estão/ })).toHaveCount(
    0,
  );
  expect((await call(page, "/cart")).data.items[0].quantity).toBe(1);
  const detail = (await call(page, `/nfts/${nftId}`)).data;
  expect(
    detail.editions.find((e: { id: string }) => e.id === "limited-50")
      .available,
  ).toBe(5);
});

test("confirmação remove somente quantidades compradas e preserva outras redes e adições", async ({
  page,
}) => {
  const wallet = await setup(page);
  let cart = (await call(page, "/cart")).data;
  await call(page, "/cart/items", "POST", {
    nftId: "nft-002",
    editionId: "unique",
    quantity: 1,
    version: cart.version,
  });
  await call(page, "/demo/orders/scenario", "POST", { order: "pending" });
  const review = await apiReview(page, wallet.id);
  expect(review.snapshot.otherItems).toBe(1);
  const order = (await send(page, review.id)).data;
  cart = (await call(page, "/cart")).data;
  await call(page, "/cart/items", "POST", {
    nftId,
    editionId: "limited-50",
    quantity: 1,
    version: cart.version,
  });
  await call(page, `/demo/orders/${order.id}/resolve`, "POST", {
    status: "confirmed",
  });
  cart = (await call(page, "/cart")).data;
  expect(
    cart.items.find((i: { nftId: string }) => i.nftId === nftId).quantity,
  ).toBe(1);
  expect(
    cart.items.find((i: { nftId: string }) => i.nftId === "nft-002").quantity,
  ).toBe(1);
});

test("recibo mantém snapshot após alteração de preço e taxa", async ({
  page,
}) => {
  const wallet = await setup(page);
  const review = await apiReview(page, wallet.id),
    order = (await send(page, review.id)).data;
  await call(page, `/demo/orders/${order.id}/resolve`, "POST", {
    status: "confirmed",
  });
  await call(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    price: "99",
  });
  await call(page, "/demo/pricing", "POST", {
    networkFee: "9",
    couponExpired: false,
  });
  const receipt = (await call(page, `/orders/${order.id}`)).data;
  expect(receipt.snapshot.quote.total).toBe("1.206");
  expect(receipt.snapshot.items[0].unitPrice).toBe("1.19");
  await page.goto(`/orders/${order.id}`);
  await expect(page.getByTestId("checkout-total")).toHaveText("1,206 ETH");
});

test("pedido e revisão alheios são recusados e lista é isolada por usuário", async ({
  page,
}) => {
  const wallet = await setup(page);
  await call(page, "/demo/orders/scenario", "POST", { order: "pending" });
  const review = await apiReview(page, wallet.id),
    order = (await send(page, review.id)).data;
  await call(page, "/auth/logout", "POST");
  await page.goto("/login?redirect=/orders");
  await page.getByLabel("E-mail", { exact: true }).fill("mario@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill("GoldoBotafogo18*");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Meus pedidos", exact: true }),
  ).toBeVisible();
  expect((await call(page, `/orders/${order.id}`)).status).toBe(403);
  expect((await send(page, review.id)).status).toBe(403);
  expect((await call(page, "/orders")).data.items).toHaveLength(0);
  await page.goto(`/orders/${order.id}`);
  await expect(
    page.getByRole("heading", { name: "Pedido indisponível" }),
  ).toBeVisible();
  await expect(page.getByText("Gabriel", { exact: true })).toHaveCount(0);
});

test("falha anterior ao aceite retoma a mesma tentativa e não perde os itens", async ({
  page,
}) => {
  await setup(page);
  await call(page, "/demo/orders/scenario", "POST", { order: "fail-once" });
  await prepare(page);
  await page
    .getByLabel("Conferi os dados, itens e valores desta compra simulada")
    .check();
  await page.getByRole("button", { name: "Confirmar compra simulada" }).click();
  await expect(
    page.getByRole("heading", { name: "Recuperando tentativa de compra" }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: /Falha antes do envio/ }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Recuperar tentativa", exact: true })
    .click();
  await expect(page).toHaveURL(/\/orders\/[^/?]+$/);
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  expect((await call(page, "/orders")).data.items).toHaveLength(1);
});

test("revisão vencida exige nova confirmação", async ({ page }) => {
  const wallet = await setup(page);
  const review = await apiReview(page, wallet.id);
  await page.clock.install();
  await page.clock.fastForward(61000);
  const response = await send(page, review.id);
  expect(response.status).toBe(409);
  expect(response.data.code).toBe("QUOTE_CHANGED");
  expect((await call(page, "/orders")).data.items).toHaveLength(0);
});

test("checkout e recibo não têm overflow e pedido inexistente não mostra sucesso", async ({
  page,
}) => {
  await setup(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/orders/inexistente");
  await expect(
    page.getByRole("heading", { name: "Pedido indisponível" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toHaveCount(0);
});

test("clique repetido na confirmação envia uma única tentativa", async ({
  page,
}) => {
  await setup(page);
  await call(page, "/demo/orders/scenario", "POST", { order: "pending" });
  await prepare(page);
  await page
    .getByLabel("Conferi os dados, itens e valores desta compra simulada")
    .check();
  let requests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/orders"
    )
      requests++;
  });
  await page
    .getByRole("button", { name: "Confirmar compra simulada", exact: true })
    .evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
  await expect(
    page.getByRole("heading", { name: "Pedido em processamento", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(1);
  expect((await call(page, "/orders")).data.items).toHaveLength(1);
});
