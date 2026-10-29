import type { AuthFields, AuthInput } from "./contracts";
export function usernameProblem(value: string) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(value.trim())
    ? ""
    : "Use de 3 a 24 letras, números ou sublinhado.";
}
export function emailProblem(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 254
    ? ""
    : "Informe um e-mail válido.";
}
export function passwordProblem(value: string) {
  return value.length >= 8 &&
    value.length <= 128 &&
    /[a-zA-Z]/.test(value) &&
    /[0-9]/.test(value)
    ? ""
    : "Use de 8 a 128 caracteres, incluindo letra e número.";
}
export function validateAuth(input: AuthInput, register: boolean): AuthFields {
  const errors: AuthFields = {};
  const username = usernameProblem(input.username);
  if (register && username) errors.username = username;
  const email = emailProblem(input.email);
  if (email) errors.email = email;
  if (!input.password) errors.password = "Informe sua senha.";
  else if (
    register ? passwordProblem(input.password) : input.password.length > 128
  )
    errors.password = "Use de 8 a 128 caracteres, incluindo letra e número.";
  if (register && input.confirmPassword !== input.password)
    errors.confirmPassword = "As senhas não coincidem.";
  return errors;
}
