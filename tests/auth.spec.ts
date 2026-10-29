import { test, expect, type Page } from "@playwright/test";
const password = "GoldoBotafogo18*";
async function login(page: Page, email = "gabriel@kurio.test") {
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("rota privada exige login e recupera a sessão após refresh", async ({
  page,
}) => {
  await page.goto("/account/profile");
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  expect(
    new URL(
      new URL(page.url()).searchParams.get("redirect")!,
      "http://localhost",
    ).pathname,
  ).toBe("/account/profile");
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Perfil do colecionador", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("gabriel@kurio.test", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("gabriel@kurio.test", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("gabriel@kurio.test", { exact: true })).toHaveCount(
    0,
  );
});

test("cadastro valida campos, cria conta persistente e permite entrar novamente", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Criar perfil", exact: true }).click();
  await expect(
    page.getByText("Informe um e-mail válido.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Nome de usuário", { exact: true })
    .fill("gabriel_teste");
  await page.getByLabel("E-mail", { exact: true }).fill("novo.colecionador@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page
    .getByLabel("Confirmar senha", { exact: true })
    .fill("Diferente123!");
  await page.getByRole("button", { name: "Criar perfil", exact: true }).click();
  await expect(
    page.getByText("As senhas não coincidem.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar perfil", exact: true }).click();
  await expect(
    page.getByText("novo.colecionador@kurio.test", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("novo.colecionador@kurio.test", { exact: true }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    localStorage.getItem("kurio.mock.database.v1"),
  );
  expect(stored).not.toContain(password);
  expect(stored).toContain("hash");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await login(page, "novo.colecionador@kurio.test");
  await expect(
    page.getByText("novo.colecionador@kurio.test", { exact: true }),
  ).toBeVisible();
});

test("API informa conflito de cadastro e credenciais inválidas", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Nome de usuário", { exact: true }).fill("outra_conta");
  await page.getByLabel("E-mail", { exact: true }).fill("GABRIEL@KURIO.TEST");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar perfil", exact: true }).click();
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByRole("alert")).toHaveText(
    "Este e-mail já possui uma conta.",
  );
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill("gabriel@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill("SenhaErrada123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "E-mail ou senha incorretos.",
  );
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Minha conta", exact: true }),
  ).toBeVisible();
});

test("retorno do login preserva busca e rejeita redirecionamento externo", async ({
  page,
}) => {
  const destination = "/?q=Emerald&sort=price-desc&page=1#catalogo";
  await page.goto("/login?" + new URLSearchParams({ redirect: destination }));
  await login(page);
  await expect(page.getByRole("textbox", { name: "Buscar NFTs" })).toHaveValue(
    "Emerald",
  );
  await expect(
    page.getByRole("combobox", { name: "Ordenar NFTs" }),
  ).toHaveValue("price-desc");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.goto("/login?redirect=https://example.com");
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Minha conta", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/account");
});

test("troca de usuário não reapresenta os dados privados da conta anterior", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  await expect(
    page.getByText("gabriel@kurio.test", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await login(page, "mario@kurio.test");
  await expect(page.getByText("mario@kurio.test", { exact: true })).toBeVisible();
  await expect(page.getByText("gabriel@kurio.test", { exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  await expect(page.getByText("mario@kurio.test", { exact: true })).toBeVisible();
});

test("expiração automática retoma a rota privada após novo login", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/account/profile");
  await login(page);
  await expect(
    page.getByText("gabriel@kurio.test", { exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(15 * 60 * 1000 + 200);
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Sua sessão expirou.");
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Perfil do colecionador", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("gabriel@kurio.test", { exact: true }),
  ).toBeVisible();
});

test("expiração durante o acesso a pagamento preserva o destino", async ({
  page,
}) => {
  await page.goto("/checkout");
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Pagamento com carteira", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await fetch("/api/demo/session/expire", { method: "POST" });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("redirect")).toBe("/checkout");
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Pagamento com carteira", exact: true }),
  ).toBeVisible();
});

test("reset remove cadastros da simulação e encerra a sessão", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Nome de usuário", { exact: true }).fill("conta_reset");
  await page.getByLabel("E-mail", { exact: true }).fill("reset@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Criar perfil", exact: true }).click();
  await expect(
    page.getByText("reset@kurio.test", { exact: true }),
  ).toBeVisible();
  await page.goto("/diagnostico");
  await expect(page.getByText("Conta atual: reset@kurio.test")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar cenário inicial" }).click();
  await expect(
    page.getByText("Nenhuma conta conectada.", { exact: true }),
  ).toBeVisible();
  await page.goto("/account/wallets");
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await login(page, "reset@kurio.test");
  await expect(page.getByRole("alert")).toHaveText(
    "E-mail ou senha incorretos.",
  );
});

test("formulário não tem overflow e o botão de senha alterna a visibilidade", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Mostrar senha", exact: true })
    .click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Ocultar senha", exact: true })
    .click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("logout descarta consulta privada lenta antes da troca de usuário", async ({
  page,
}) => {
  await page.goto("/login");
  await login(page);
  await expect(
    page.getByText("gabriel@kurio.test", { exact: true }),
  ).toBeVisible();
  await page.goto("/account/profile?accountScenario=slow");
  await expect(
    page.getByRole("status", { name: "Carregando dados da conta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await login(page, "mario@kurio.test");
  await expect(page.getByText("mario@kurio.test", { exact: true })).toBeVisible();
  await expect(page.getByText("gabriel@kurio.test", { exact: true })).toHaveCount(
    0,
  );
});

test("logout em outra aba remove acesso à conta nesta aba", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await login(page);
  await expect(
    page.getByText("gabriel@kurio.test", { exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/account/profile");
  await expect(
    other.getByText("gabriel@kurio.test", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    other.getByRole("heading", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await expect(other.getByText("gabriel@kurio.test", { exact: true })).toHaveCount(
    0,
  );
});

test("clique repetido não envia duas tentativas de login", async ({ page }) => {
  await page.goto("/login");
  let requests = 0;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/auth/login") &&
      request.method() === "POST"
    )
      requests += 1;
  });
  await page.getByLabel("E-mail", { exact: true }).fill("gabriel@kurio.test");
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).dblclick();
  await expect(
    page.getByText("gabriel@kurio.test", { exact: true }),
  ).toBeVisible();
  expect(requests).toBe(1);
});
