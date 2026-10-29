import type { PasswordInput, ProfileInput, WalletInput } from "./contracts";
import { walletTypes } from "./contracts";
import { networks } from "../catalog/contracts";
import {
  emailProblem,
  passwordProblem,
  usernameProblem,
} from "../auth/validation";
export function validEns(value: string) {
  return !value || /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\.eth$/i.test(value);
}
export function validAddress(value: string, network: string) {
  return network === "Solana"
    ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
    : /^0x[a-fA-F0-9]{40}$/.test(value);
}
export function avatarProblem(value: unknown): string {
  if (value === null) return "";
  if (
    typeof value !== "string" ||
    value.length > 700000 ||
    !/^data:image\/(png|jpeg|webp);base64,/.test(value)
  )
    return "Use PNG, JPEG ou WebP de até 512 KB.";
  try {
    const [prefix, content] = value.split(",");
    const bytes = atob(content);
    if (bytes.length > 512 * 1024) return "O avatar deve ter até 512 KB.";
    const png = bytes.startsWith("\x89PNG\r\n\x1a\n");
    const jpeg = bytes.startsWith("\xff\xd8\xff");
    const webp = bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
    if (!(
      (prefix.includes("png") && png) ||
      (prefix.includes("jpeg") && jpeg) ||
      (prefix.includes("webp") && webp)
    ))
      return "O arquivo de imagem é inválido.";
  } catch {
    return "O arquivo de imagem é inválido.";
  }
  return "";
}
export function validateProfile(input: ProfileInput) {
  const errors: Record<string, string> = {};
  if (
    input.displayName.trim().length < 2 ||
    input.displayName.trim().length > 60
  )
    errors.displayName = "Use de 2 a 60 caracteres.";
  const username = usernameProblem(input.username);
  if (username) errors.username = username;
  const email = emailProblem(input.email);
  if (email) errors.email = email;
  if (
    input.walletNickname.trim().length < 2 ||
    input.walletNickname.trim().length > 30
  )
    errors.walletNickname = "Use de 2 a 30 caracteres.";
  if (!validEns(input.ens.trim()))
    errors.ens =
      "Informe um nome ENS válido, como colecionador.eth, ou deixe vazio.";
  const avatar = avatarProblem(input.avatar);
  if (avatar) errors.avatar = avatar;
  return errors;
}
export function validatePassword(input: PasswordInput) {
  const errors: Record<string, string> = {};
  if (!input.currentPassword || input.currentPassword.length > 128)
    errors.currentPassword = "Informe sua senha atual.";
  const problem = passwordProblem(input.newPassword);
  if (problem) errors.newPassword = problem;
  if (input.newPassword === input.currentPassword)
    errors.newPassword = "A nova senha deve ser diferente da atual.";
  if (input.confirmPassword !== input.newPassword)
    errors.confirmPassword = "As senhas não coincidem.";
  return errors;
}
export function validateWallet(input: WalletInput) {
  const errors: Record<string, string> = {};
  for (const key of ["displayName", "nickname", "profileName"] as const)
    if (input[key].trim().length < 2 || input[key].trim().length > 60)
      errors[key] = "Use de 2 a 60 caracteres.";
  if (!networks.includes(input.network)) errors.network = "Selecione uma rede.";
  if (!validAddress(input.address.trim(), input.network))
    errors.address =
      input.network === "Solana"
        ? "Informe um endereço Solana com 32 a 44 caracteres base58."
        : "Informe 0x seguido de 40 caracteres hexadecimais.";
  if (!walletTypes.includes(input.walletType))
    errors.walletType = "Selecione um tipo de carteira.";
  const email = emailProblem(input.email);
  if (email) errors.email = email;
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(input.referralCode.trim()))
    errors.referralCode = "Use de 3 a 32 letras, números, hífen ou sublinhado.";
  if (!validEns(input.ens.trim()))
    errors.ens = "Informe um ENS válido ou deixe vazio.";
  const secondary = input.secondaryReference.trim();
  if (
    secondary &&
    !validEns(secondary) &&
    !validAddress(secondary, input.network)
  )
    errors.secondaryReference =
      "Informe um ENS ou endereço válido para a rede escolhida.";
  return errors;
}
