import "./index.css";
async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MOCKS === "true") {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass", quiet: true });
  }
  // Importar depois do MSW evita que Socket.IO capture o WebSocket nativo antes da interceptação.
  const { renderApp } = await import("./app/render");
  renderApp();
}
void bootstrap().catch((error: unknown) => {
  console.error(error);
  document.getElementById("root")!.textContent =
    "Falha ao iniciar a aplicação. Consulte o console e a configuração de mocks.";
});
