import axios from "axios";
export const api = axios.create({
  baseURL: "/api",
  timeout: 8000,
  withCredentials: true,
});
let unauthorized: (() => void) | undefined;
export function setUnauthorizedHandler(handler: () => void) {
  unauthorized = handler;
}
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      ["SESSION_EXPIRED", "SESSION_INVALID", "UNAUTHENTICATED"].includes(
        error.response.data?.code,
      )
    )
      unauthorized?.();
    return Promise.reject(error);
  },
);
