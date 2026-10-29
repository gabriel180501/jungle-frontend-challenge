export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}
export interface Session {
  user: User | null;
  expiresAt: string | null;
}
export interface AuthInput {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}
export type AuthFields = Partial<Record<keyof AuthInput, string>>;
export interface AuthError {
  code: string;
  message: string;
  fields?: AuthFields;
}
export const anonymousSession: Session = { user: null, expiresAt: null };
