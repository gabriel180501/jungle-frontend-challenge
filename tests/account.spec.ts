import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
const password = "GoldoBotafogo18*";
async function login(
  page: Page,
  destination = "/account/profile",
  email = "gabriel@kurio.test",
  secret = password,
) {
  await page.goto("/login?" + new URLSearchParams({ redirect: destination }));
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).not.toBeVisible();
}
async function favoriteScenario(page: Page, mode: string) {
  await page.evaluate(async (mode) => {
    const response = await fetch("/api/demo/favorites/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!response.ok) throw new Error("Falha ao configurar cenário");
  }, mode);
}
async function pause(page: Page) {
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 10000),
  );
}
async function finishFavorite(page: Page, id: string) {
  const button = page.getByTestId(`favorite-${id}`).filter({ visible: true });
  await expect
    .poll(
      async () => {
        await page.clock.runFor(300);
        return button.isEnabled();
      },
      { timeout: 10000 },
    )
    .toBe(true);
}
async function primaryWallet(page: Page) {
  const form = page.getByRole("form", {
    name: "Carteira principal",
    exact: true,
  });
  await form
    .getByLabel("Endereço da carteira", { exact: true })
    .fill("0x" + "1".repeat(40));
  await form
    .getByLabel("Tipo de carteira", { exact: true })
    .selectOption("MetaMask");
  await form
    .getByLabel("Código de indicação", { exact: true })
    .fill("KURIO2026");
  await form
    .getByRole("button", { name: "Salvar carteira principal", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Carteira principal salva." }),
  ).toBeVisible();
}

test("edita perfil, atualiza identidade e persiste após refresh e novo login", async ({
  page,
}) => {
  await login(page);
  const form = page.getByRole("form", { name: "Dados do perfil", exact: true });
  await form
    .getByLabel("Nome de exibição", { exact: true })
    .fill("Nova Colecionadora");
  await form
    .getByLabel("Nome de usuário", { exact: true })
    .fill("nova_editada");
  await form
    .getByLabel("E-mail", { exact: true })
    .fill("nova.editada@kurio.test");
  await form
    .getByLabel("Nome ENS (opcional)", { exact: true })
    .fill("novasato.eth");
  await form
    .getByLabel("Apelido da carteira", { exact: true })
    .fill("Minha principal");
  await form
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(form.getByRole("status")).toHaveText("Perfil atualizado.");
  await page.reload();
  await expect(
    page.getByLabel("Nome de exibição", { exact: true }),
  ).toHaveValue("Nova Colecionadora");
  await expect(
    page.getByLabel("Nome ENS (opcional)", { exact: true }),
  ).toHaveValue("novasato.eth");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("nova.editada@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByLabel("Nome de usuário", { exact: true })).toHaveValue(
    "nova_editada",
  );
});

test("perfil apresenta validações e conflito de e-mail retornado pela API", async ({
  page,
}) => {
  await login(page);
  const form = page.getByRole("form", { name: "Dados do perfil", exact: true });
  await form.getByLabel("Nome de exibição", { exact: true }).fill("A");
  await form
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(
    form.getByLabel("Nome de exibição", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await form.getByLabel("Nome de exibição", { exact: true }).fill("Gabriel");
  await form.getByLabel("E-mail", { exact: true }).fill("mario@kurio.test");
  await form
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "Este e-mail já possui uma conta.",
  );
  await expect(form.getByLabel("E-mail", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await form.getByLabel("E-mail", { exact: true }).fill("gabriel@kurio.test");
  await form
    .getByLabel("Nome ENS (opcional)", { exact: true })
    .fill("invalido");
  await form
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(
    form.getByLabel("Nome ENS (opcional)", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
});

test("avatar valida arquivo, salva, recupera após refresh e permite remover", async ({
  page,
}) => {
  await login(page);
  await page.getByLabel("Avatar", { exact: true }).setInputFiles({
    name: "avatar.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("arquivo inválido"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Use PNG, JPEG ou WebP de até 512 KB.",
  );
  await page
    .getByLabel("Avatar", { exact: true })
    .setInputFiles(path.resolve("public/images/emerald-ape.webp"));
  await expect(page.getByAltText("Prévia do avatar")).toBeVisible();
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Perfil atualizado." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByAltText("Prévia do avatar")).toBeVisible();
  await page
    .getByRole("button", { name: "Remover avatar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Perfil atualizado." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Sem avatar")).toBeVisible();
});

test("senha atual é conferida e somente a nova senha permite o próximo login", async ({
  page,
}) => {
  await login(page);
  const form = page.getByRole("form", { name: "Alterar senha", exact: true });
  await form.getByLabel("Senha atual", { exact: true }).fill("Errada123!");
  await form.getByLabel("Nova senha", { exact: true }).fill("NovaSenha456!");
  await form
    .getByLabel("Confirmar nova senha", { exact: true })
    .fill("NovaSenha456!");
  await form.getByRole("button", { name: "Salvar senha", exact: true }).click();
  await expect(form.getByRole("alert")).toHaveText(
    "A senha atual está incorreta.",
  );
  await form.getByLabel("Senha atual", { exact: true }).fill(password);
  await form.getByRole("button", { name: "Salvar senha", exact: true }).click();
  await expect(form.getByRole("status")).toContainText("Senha alterada.");
  const database = await page.evaluate(() =>
    localStorage.getItem("kurio.mock.database.v1"),
  );
  expect(database).not.toContain("NovaSenha456!");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page.getByLabel("E-mail", { exact: true }).fill("gabriel@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "E-mail ou senha incorretos.",
  );
  await page.getByLabel("Senha", { exact: true }).fill("NovaSenha456!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Perfil do colecionador", exact: true }),
  ).toBeVisible();
});

test("cadastra carteiras principal e secundária, edita e preserva após refresh", async ({
  page,
}) => {
  await login(page, "/account/wallets");
  await primaryWallet(page);
  await page
    .getByRole("button", { name: "Adicionar carteira secundária", exact: true })
    .click();
  const form = page.getByRole("form", {
    name: "Carteira secundária",
    exact: true,
  });
  await form
    .getByRole("button", {
      name: "Usar dados da carteira principal",
      exact: true,
    })
    .click();
  await form.getByLabel("Rede", { exact: true }).selectOption("Polygon");
  await form
    .getByLabel("Endereço da carteira", { exact: true })
    .fill("0x" + "2".repeat(40));
  await form
    .getByLabel("Tipo de carteira", { exact: true })
    .selectOption("WalletConnect");
  await form
    .getByRole("button", { name: "Salvar carteira secundária", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Carteira secundária salva." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("0x" + "1".repeat(40), { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("0x" + "2".repeat(40), { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar carteira principal", exact: true })
    .click();
  await page
    .getByRole("form", { name: "Carteira principal", exact: true })
    .getByLabel("Apelido da carteira", { exact: true })
    .fill("Minha carteira editada");
  await page
    .getByRole("button", { name: "Salvar carteira principal", exact: true })
    .click();
  await expect(
    page.getByText("Minha carteira editada", { exact: true }),
  ).toBeVisible();
});

test("carteira valida endereço e impede duplicidade na mesma rede", async ({
  page,
}) => {
  await login(page, "/account/wallets");
  const primary = page.getByRole("form", {
    name: "Carteira principal",
    exact: true,
  });
  await primary
    .getByLabel("Endereço da carteira", { exact: true })
    .fill("0x123");
  await primary
    .getByRole("button", { name: "Salvar carteira principal", exact: true })
    .click();
  await expect(
    primary.getByLabel("Endereço da carteira", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await primaryWallet(page);
  await page
    .getByRole("button", { name: "Adicionar carteira secundária", exact: true })
    .click();
  const secondary = page.getByRole("form", {
    name: "Carteira secundária",
    exact: true,
  });
  await secondary
    .getByRole("button", {
      name: "Usar dados da carteira principal",
      exact: true,
    })
    .click();
  await secondary
    .getByLabel("Endereço da carteira", { exact: true })
    .fill("0x" + "1".repeat(40));
  await secondary
    .getByLabel("Tipo de carteira", { exact: true })
    .selectOption("MetaMask");
  await secondary
    .getByRole("button", { name: "Salvar carteira secundária", exact: true })
    .click();
  await expect(secondary.getByRole("alert")).toContainText(
    "Este endereço já está cadastrado nesta rede.",
  );
  await secondary.getByLabel("Rede", { exact: true }).selectOption("Solana");
  await secondary
    .getByLabel("Endereço da carteira", { exact: true })
    .fill("3".repeat(32));
  await secondary
    .getByRole("button", { name: "Salvar carteira secundária", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Carteira secundária salva." }),
  ).toBeVisible();
});

test("favorito exige login e a intenção retorna ao NFT de origem", async ({
  page,
}) => {
  await page.goto("/nfts/emerald-ape-042");
  await page
    .getByRole("button", { name: "Favoritar Emerald Ape #042", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  expect(
    new URL(
      new URL(page.url()).searchParams.get("redirect")!,
      "http://localhost",
    ).pathname,
  ).toBe("/nfts/emerald-ape-042");
});

test("favorito é otimista, persiste no refresh e pode ser removido da lista", async ({
  page,
}) => {
  await page.clock.install();
  await login(page, "/nfts/emerald-ape-042");
  const button = page
    .getByRole("button", { name: "Favoritar Emerald Ape #042", exact: true })
    .filter({ visible: true });
  await expect(button).toBeEnabled();
  await favoriteScenario(page, "slow");
  await pause(page);
  await button.click();
  await page.clock.runFor(1);
  const saved = page
    .getByRole("button", {
      name: "Remover Emerald Ape #042 dos favoritos",
      exact: true,
    })
    .filter({ visible: true });
  await expect(saved).toHaveAttribute("aria-pressed", "true");
  await expect(saved).toBeDisabled();
  await finishFavorite(page, "emerald-ape-042");
  await expect(saved).toBeEnabled();
  await page.clock.resume();
  await page.reload();
  await expect(
    page.getByTestId("favorite-emerald-ape-042").filter({ visible: true }),
  ).toBeEnabled({ timeout: 10000 });
  await expect(
    page
      .getByRole("button", {
        name: "Remover Emerald Ape #042 dos favoritos",
        exact: true,
      })
      .filter({ visible: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/account/favorites");
  await expect(
    page.getByRole("link", { name: /Emerald Ape #042/ }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Remover Emerald Ape #042 dos favoritos",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Sua lista ainda está vazia.",
      exact: true,
    }),
  ).toBeVisible();
});

test("falha do favorito desfaz a alteração e permite nova tentativa", async ({
  page,
}) => {
  await page.clock.install();
  await login(page, "/nfts/emerald-ape-042");
  const first = page
    .getByRole("button", { name: "Favoritar Emerald Ape #042", exact: true })
    .filter({ visible: true });
  await expect(first).toBeEnabled();
  await favoriteScenario(page, "fail-once");
  await pause(page);
  await first.click();
  await page.clock.runFor(1);
  await expect(
    page
      .getByRole("button", {
        name: "Remover Emerald Ape #042 dos favoritos",
        exact: true,
      })
      .filter({ visible: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await finishFavorite(page, "emerald-ape-042");
  await expect(page.getByRole("alert")).toContainText(
    "A alteração foi desfeita.",
  );
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await first.click();
  await finishFavorite(page, "emerald-ape-042");
  await expect(
    page
      .getByRole("button", {
        name: "Remover Emerald Ape #042 dos favoritos",
        exact: true,
      })
      .filter({ visible: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.clock.resume();
});

test("rollback de um favorito não apaga outro favorito salvo em paralelo", async ({
  page,
}) => {
  await page.clock.install();
  await login(page, "/");
  const first = page.getByRole("button", {
    name: "Favoritar Emerald Ape #042",
    exact: true,
  });
  const second = page.getByRole("button", {
    name: "Favoritar Sage Nomad #009",
    exact: true,
  });
  await expect(first).toBeEnabled();
  await expect(second).toBeEnabled();
  await favoriteScenario(page, "fail-once");
  await pause(page);
  await first.click();
  await second.click();
  await finishFavorite(page, "emerald-ape-042");
  await finishFavorite(page, "nft-002");
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", {
      name: "Remover Sage Nomad #009 dos favoritos",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.clock.resume();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Favoritar Emerald Ape #042",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", {
      name: "Remover Sage Nomad #009 dos favoritos",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("favoritos e carteiras ficam isolados entre usuários", async ({
  page,
}) => {
  await login(page, "/nfts/emerald-ape-042");
  await page
    .getByRole("button", { name: "Favoritar Emerald Ape #042", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page
      .getByRole("button", {
        name: "Remover Emerald Ape #042 dos favoritos",
        exact: true,
      })
      .filter({ visible: true }),
  ).toBeEnabled();
  await page.goto("/account/wallets");
  await primaryWallet(page);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page.getByLabel("E-mail", { exact: true }).fill("mario@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page
      .getByRole("form", { name: "Carteira principal", exact: true })
      .getByLabel("Endereço da carteira", { exact: true }),
  ).toHaveValue("");
  await page.goto("/account/favorites");
  await expect(
    page.getByRole("heading", {
      name: "Sua lista ainda está vazia.",
      exact: true,
    }),
  ).toBeVisible();
});

test("API recusa alterar carteira pertencente a outro usuário", async ({
  page,
}) => {
  await login(page, "/account/wallets");
  await primaryWallet(page);
  const wallet = await page.evaluate(
    async () => (await (await fetch("/api/wallets")).json()).items[0],
  );
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await page.getByLabel("E-mail", { exact: true }).fill("mario@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("form", { name: "Carteira principal", exact: true }),
  ).toBeVisible();
  const result = await page.evaluate(async (wallet) => {
    const response = await fetch(`/api/wallets/${wallet.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...wallet, nickname: "Alteração indevida" }),
    });
    return { status: response.status, body: await response.json() };
  }, wallet);
  expect(result.status).toBe(403);
  expect(result.body.code).toBe("FORBIDDEN");
});
