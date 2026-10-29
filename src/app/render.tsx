import { RealtimeProvider } from "../realtime/provider";
import { AuthProvider } from "../features/auth/provider";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { queryClient } from "./query-client";
const onSessionChange = () => {
  void router.invalidate();
};
export function renderApp() {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider onSessionChange={onSessionChange}>
          <RealtimeProvider>
            <RouterProvider router={router} />
          </RealtimeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
