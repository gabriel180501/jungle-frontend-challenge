import { test, expect } from "@playwright/test";

test("REST e Socket.IO continuam funcionando na área de diagnóstico", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/diagnostico");
  await expect(page.getByText("API simulada Kurio:")).toBeVisible();
  await expect(
    page.getByText("Socket conectado", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Testar evento", exact: true })
    .click();
  await expect(
    page.getByText("Evento recebido pelo mock Socket.IO"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("rota inexistente permite retornar ao catálogo", async ({ page }) => {
  await page.goto("/nao-existe");
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await expect(
    page.getByRole("heading", { name: /SEJA DONO DO FUTURO/ }),
  ).toBeVisible();
  await expect(page.getByTestId("nft-card")).toHaveCount(9);
});
