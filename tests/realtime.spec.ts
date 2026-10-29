import { test, expect, type Page } from "@playwright/test";
const nftId = "emerald-ape-042";
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
const control = (page: Page, action: string, type = "nft.updated") =>
  call(page, "/demo/realtime/control", "POST", { action, type });
async function ready(page: Page) {
  await expect(page.getByTestId("rt-status")).toHaveText("connected");
}
async function guestCart(page: Page) {
  await page.goto("/nfts/emerald-ape-042");
  await page.getByRole("button", { name: "Comprar NFT", exact: true }).click();
  await expect(page.getByTestId("cart-total")).toHaveText("1,206 ETH");
}
async function checkout(page: Page) {
  await page.goto("/login?redirect=/cart");
  await page.getByLabel("E-mail", { exact: true }).fill("gabriel@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill("GoldoBotafogo18*");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Carrinho de NFTs", exact: true }),
  ).toBeVisible();
  const wallet = (
    await call(page, "/wallets", "POST", {
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
    })
  ).data;
  const cart = (await call(page, "/cart")).data;
  await call(page, "/cart/items", "POST", {
    nftId,
    editionId: "limited-50",
    quantity: 1,
    version: cart.version,
  });
  await page.goto("/checkout");
  await expect(page.getByTestId("checkout-total")).toHaveText("1,206 ETH");
  return wallet;
}
async function review(page: Page) {
  await page
    .getByRole("button", { name: "Conectar carteira simulada" })
    .click();
  await expect(
    page.getByText("Carteira conectada (simulação).", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revisar compra", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Revise antes de confirmar" }),
  ).toBeVisible();
}

test("eventos Socket.IO têm versão, atualizam REST e duplicados/antigos não repetem reconciliação", async ({
  page,
}) => {
  await page.goto("/diagnostico");
  await ready(page);
  await call(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    price: "1.5",
  });
  await expect
    .poll(async () =>
      Number(await page.getByTestId("rt-accepted").textContent()),
    )
    .toBeGreaterThan(0);
  await ready(page);
  const first = (await call(page, `/nfts/${nftId}`)).data;
  expect(first.price).toBe("1.5");
  expect(first.version).toBeGreaterThan(1);
  const reconciliations = await page
      .getByTestId("rt-reconciliations")
      .textContent(),
    accepted = await page.getByTestId("rt-accepted").textContent();
  await control(page, "duplicate");
  await expect(page.getByTestId("rt-ignored")).toHaveText("1");
  await control(page, "stale");
  await expect(page.getByTestId("rt-ignored")).toHaveText("2");
  await expect(page.getByTestId("rt-accepted")).toHaveText(accepted!);
  await expect(page.getByTestId("rt-reconciliations")).toHaveText(
    reconciliations!,
  );
  await call(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    price: "1.7",
  });
  await expect(page.getByTestId("rt-accepted")).toHaveText(
    String(Number(accepted) + 1),
  );
  expect((await call(page, `/nfts/${nftId}`)).data.version).toBeGreaterThan(
    first.version,
  );
});

test("nft.updated chega ao catálogo, detalhe e carrinho por sockets de abas distintas", async ({
  page,
  context,
}) => {
  await guestCart(page);
  const detail = await context.newPage();
  await detail.goto("/nfts/emerald-ape-042");
  await expect(detail.getByTestId("unit-price")).toHaveText("1,19 ETH");
  const catalog = await context.newPage();
  await catalog.goto("/?q=Emerald");
  await expect(
    catalog.getByTestId("nft-card").filter({ hasText: "Emerald Ape #042" }),
  ).toBeVisible();
  await call(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    price: "1.5",
    available: 2,
  });
  await expect(page.getByTestId("cart-total")).toHaveText("1,516 ETH", {
    timeout: 5000,
  });
  await expect(detail.getByTestId("unit-price")).toHaveText("1,50 ETH", {
    timeout: 5000,
  });
  await expect(
    catalog.getByTestId("nft-card").filter({ hasText: "Emerald Ape #042" }),
  ).toContainText("1,50 ETH", { timeout: 5000 });
  await expect(
    page.getByText(
      "Preço ou disponibilidade de NFT alterado. Confira os valores atualizados.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("interrupção perde atualização, reconexão consulta REST e recupera a cotação", async ({
  page,
}) => {
  await guestCart(page);
  await control(page, "interrupt");
  await expect(
    page.getByText(
      "Atualizações em tempo real interrompidas. Aguardando reconexão.",
      { exact: true },
    ),
  ).toBeVisible();
  await call(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    price: "2",
  });
  await expect(page.getByTestId("cart-total")).toHaveText("1,206 ETH");
  await control(page, "resume");
  await expect(page.getByTestId("cart-total")).toHaveText("2,016 ETH", {
    timeout: 5000,
  });
  await expect(
    page.getByText(
      "Atualizações em tempo real interrompidas. Aguardando reconexão.",
      { exact: true },
    ),
  ).toHaveCount(0);
});

test("mensagem perdida é reconciliada mesmo sem replay de eventos", async ({
  page,
}) => {
  await guestCart(page);
  await control(page, "drop-next");
  await call(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    price: "2.2",
  });
  await expect(page.getByTestId("cart-total")).toHaveText("1,206 ETH");
  await control(page, "interrupt");
  await control(page, "resume");
  await expect(page.getByTestId("cart-total")).toHaveText("2,216 ETH", {
    timeout: 5000,
  });
});

test("checkout impede confirmação offline e exige revisar preço recuperado", async ({
  page,
}) => {
  await checkout(page);
  await review(page);
  await page
    .getByLabel("Conferi os dados, itens e valores desta compra simulada")
    .check();
  await control(page, "interrupt");
  await expect(
    page.getByRole("button", { name: "Confirmar compra simulada" }),
  ).toBeDisabled();
  await call(page, "/demo/market", "POST", {
    nftId,
    editionId: "limited-50",
    price: "1.6",
  });
  await expect(page.getByTestId("checkout-total")).toHaveText("1,206 ETH");
  await control(page, "resume");
  await expect(page.getByTestId("checkout-total")).toHaveText("1,616 ETH", {
    timeout: 5000,
  });
  await expect(
    page.getByRole("alert").filter({ hasText: /cotação mudou/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar compra simulada" }),
  ).toBeDisabled();
  expect((await call(page, "/orders")).data.items).toHaveLength(0);
});

test("order.updated conclui pendente sem polling rápido e estado terminal não regride", async ({
  page,
}) => {
  await checkout(page);
  await call(page, "/demo/orders/scenario", "POST", { order: "pending" });
  await review(page);
  await page
    .getByLabel("Conferi os dados, itens e valores desta compra simulada")
    .check();
  await page.getByRole("button", { name: "Confirmar compra simulada" }).click();
  await expect(
    page.getByRole("heading", { name: "Pedido em processamento", exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await call(page, `/demo/orders/${id}/resolve`, "POST", {
    status: "confirmed",
  });
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toBeVisible({ timeout: 5000 });
  await control(page, "duplicate", "order.updated");
  await control(page, "stale", "order.updated");
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toBeVisible();
  expect((await call(page, "/orders")).data.items).toHaveLength(1);
  expect((await call(page, "/cart")).data.items).toHaveLength(0);
});

test("pedido finalizado durante interrupção é recuperado ao reconectar sem novo POST", async ({
  page,
}) => {
  await checkout(page);
  await call(page, "/demo/orders/scenario", "POST", { order: "pending" });
  await review(page);
  await page
    .getByLabel("Conferi os dados, itens e valores desta compra simulada")
    .check();
  await page.getByRole("button", { name: "Confirmar compra simulada" }).click();
  await expect(
    page.getByRole("heading", { name: "Pedido em processamento", exact: true }),
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/orders")
      writes++;
  });
  await control(page, "interrupt");
  await expect(
    page.getByText(
      "Atualizações em tempo real interrompidas. Aguardando reconexão.",
      { exact: true },
    ),
  ).toBeVisible();
  await call(page, `/demo/orders/${id}/resolve`, "POST", {
    status: "confirmed",
  });
  await expect(
    page.getByRole("heading", { name: "Pedido em processamento", exact: true }),
  ).toBeVisible();
  await control(page, "resume");
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toBeVisible({ timeout: 5000 });
  expect(writes).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Compra confirmada", exact: true }),
  ).toBeVisible();
});

test("mensagens de outra conta ou subscription anterior são descartadas", async ({
  page,
}) => {
  await checkout(page);
  await page.goto("/diagnostico");
  await ready(page);
  let reads = 0;
  page.on("request", (r) => {
    if (r.url().includes("/orders/unowned-simulation")) reads++;
  });
  await control(page, "foreign");
  await expect(page.getByTestId("rt-ignored")).toHaveText("1");
  await control(page, "old-session");
  await expect(page.getByTestId("rt-ignored")).toHaveText("2");
  await expect(page.getByTestId("rt-accepted")).toHaveText("0");
  expect(reads).toBe(0);
});

test("navegar libera listeners e sockets de diagnóstico sem acumular subscriptions", async ({
  page,
}) => {
  await page.goto("/diagnostico");
  await ready(page);
  for (let i = 0; i < 3; i++) {
    await expect
      .poll(
        async () => (await call(page, "/demo/realtime/stats")).data.connections,
      )
      .toBe(2);
    await page
      .getByRole("link", { name: "Kurio, início", exact: true })
      .click();
    await expect
      .poll(
        async () => (await call(page, "/demo/realtime/stats")).data.connections,
      )
      .toBe(1);
    await page
      .getByRole("link", { name: "Diagnóstico e cenários", exact: true })
      .click();
    await ready(page);
  }
  await expect(page.getByTestId("rt-subscriptions")).toHaveText("1");
});

test("logout troca a subscription e não recebe dados privados da sessão anterior", async ({
  page,
}) => {
  await checkout(page);
  await page.goto("/diagnostico");
  await ready(page);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^(Sair|Saindo…)$/ }),
  ).toHaveCount(0);
  await ready(page);
  await expect(page.getByTestId("rt-subscriptions")).toHaveText("1");
  await control(page, "foreign");
  await expect(page.getByTestId("rt-ignored")).toHaveText("1");
  await expect(page.getByTestId("rt-accepted")).toHaveText("0");
  expect((await call(page, "/cart")).data.items).toHaveLength(0);
});
