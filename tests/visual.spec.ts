import { test, expect } from "@playwright/test";

test("início mantém a composição visual", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images];
    images.forEach((image) => {
      image.loading = "eager";
    });
    await Promise.all(images.map((image) => image.decode()));
  });
  await expect(page).toHaveScreenshot("inicio.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.005,
  });
});

test("detalhe mantém a composição visual", async ({ page }) => {
  await page.goto("/nfts/emerald-ape-042");
  await expect(
    page.getByRole("heading", { name: "Emerald Ape #042", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images];
    images.forEach((image) => {
      image.loading = "eager";
    });
    await Promise.all(images.map((image) => image.decode()));
  });
  await expect(page).toHaveScreenshot("detalhe.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.005,
  });
});

for (const [path, title, file] of [
  ["/login", "Entrar", "login.png"],
  ["/register", "Criar perfil de colecionador", "cadastro.png"],
] as const) {
  test(`${title} mantém a composição visual`, async ({ page }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".auth-backdrop-catalog article")).toHaveCount(9);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    await expect(page).toHaveScreenshot(file, {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.005,
    });
  });
}

for (const [destination, title, file] of [
  ["/account/profile", "Perfil do colecionador", "perfil.png"],
  ["/account/wallets", "Carteiras", "carteiras.png"],
  ["/account/favorites", "Lista de interesse", "favoritos.png"],
] as const) {
  test(`${title} mantém a composição visual da conta`, async ({ page }) => {
    await page.goto("/login?" + new URLSearchParams({ redirect: destination }));
    await page.getByLabel("E-mail", { exact: true }).fill("gabriel@kurio.test");
    await page.getByLabel("Senha", { exact: true }).fill("GoldoBotafogo18*");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    if (destination.endsWith("profile")) {
      await expect(
        page.getByLabel("Nome de exibição", { exact: true }),
      ).toHaveValue("Gabriel");
    } else if (destination.endsWith("wallets")) {
      await expect(
        page.getByRole("form", { name: "Carteira principal", exact: true }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", {
          name: "Sua lista ainda está vazia.",
          exact: true,
        }),
      ).toBeVisible();
      await page.goto("/nfts/emerald-ape-042");
      await page
        .getByRole("button", {
          name: "Favoritar Emerald Ape #042",
          exact: true,
        })
        .filter({ visible: true })
        .click();
      await expect(
        page.getByText("NFT salvo nos favoritos.", { exact: true }),
      ).toHaveCount(1);
      await page.goto(destination);
      await expect(
        page.getByRole("link", { name: /Emerald Ape #042/ }),
      ).toBeVisible();
    }
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    await expect(page).toHaveScreenshot(file, {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.005,
    });
  });
}

test("carrinho mantém composição visual com itens e cotação", async ({
  page,
}) => {
  await page.goto("/nfts/emerald-ape-042");
  await page.getByLabel("Qtd.", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Comprar NFT", exact: true }).click();
  await expect(page.getByTestId("cart-total")).toHaveText("2,396 ETH");
  await expect(
    page.locator('.related-nfts [data-testid="nft-card"]'),
  ).toHaveCount(5);
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images];
    images.forEach((image) => (image.loading = "eager"));
    await Promise.all(images.map((image) => image.decode()));
  });
  await expect(page).toHaveScreenshot("carrinho.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.005,
  });
});

for (const receipt of [false, true]) {
  test(`${receipt ? "recibo confirmado" : "pagamento"} mantém composição visual`, async ({
    page,
  }) => {
    await page.goto("/login?redirect=/cart");
    await page.getByLabel("E-mail", { exact: true }).fill("gabriel@kurio.test");
    await page.getByLabel("Senha", { exact: true }).fill("GoldoBotafogo18*");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Carrinho de NFTs", exact: true }),
    ).toBeVisible();
    const result = await page.evaluate(async () => {
      const post = async (path: string, body: unknown) => {
        const response = await fetch(`/api${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`Fixture HTTP ${response.status}`);
        return response.json();
      };
      const wallet = await post("/wallets", {
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
      const cart = await (await fetch("/api/cart")).json();
      await post("/cart/items", {
        nftId: "emerald-ape-042",
        editionId: "limited-50",
        quantity: 2,
        version: cart.version,
      });
      return wallet;
    });
    await page.goto("/checkout");
    await expect(page.getByTestId("checkout-total")).toHaveText("2,396 ETH");
    await page
      .getByRole("button", { name: "Conectar carteira simulada" })
      .click();
    await expect(
      page.getByText("Carteira conectada (simulação).", { exact: true }),
    ).toBeVisible();
    if (receipt) {
      await page.evaluate(async (walletId: string) => {
        const post = async (
          path: string,
          body: unknown,
          extra: Record<string, string> = {},
        ) => {
          const response = await fetch(`/api${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...extra },
            body: JSON.stringify(body),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        };
        await post("/demo/orders/scenario", { order: "pending" }).catch(
          () => {},
        );
        const connection = await post("/wallet-connections", {
          walletId,
          network: "Ethereum",
        });
        const review = await post("/checkout/review", {
          connectionId: connection.id,
          collector: {
            displayName: "Gabriel",
            username: "gabriel_usuario",
            profileName: "gabriel_usuario",
            referralCode: "KURIO2026",
            email: "gabriel@kurio.test",
            ens: "",
            secondaryReference: "",
            note: "",
          },
        });
        const order = await post(
          "/orders",
          { reviewId: review.id },
          { "Idempotency-Key": "visual-receipt-key" },
        );
        await post(`/demo/orders/${order.id}/resolve`, { status: "confirmed" });
        history.replaceState({}, "", `/orders/${order.id}`);
      }, result.id);
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Compra confirmada", exact: true }),
      ).toBeVisible();
    }
    await page.evaluate(async () => {
      window.scrollTo({ top: 0, behavior: "instant" });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    await expect(page).toHaveScreenshot(
      receipt ? "recibo.png" : "pagamento.png",
      {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.005,
        ...(receipt
          ? {
              mask: [
                page.locator(".receipt-details dd").nth(0),
                page.locator(".receipt-details dd").nth(1),
                page.locator(".receipt-details dd").last(),
              ],
            }
          : {}),
      },
    );
  });
}
