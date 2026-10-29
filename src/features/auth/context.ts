import { createContext, useContext } from "react";
import type { User } from "./contracts";
interface AuthState {
  user: User | null;
  loading: boolean;
  error: boolean;
  expired: boolean;
  refresh: () => void;
}
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider ausente");
  return context;
}
