import type { Collector } from "./contracts";
import { emailProblem, usernameProblem } from "../auth/validation";
import { validAddress, validEns } from "../account/validation";
export function validateCollector(input: Collector, network: string) {
  const fields: Record<string, string> = {};
  for (const key of ["displayName", "profileName"] as const)
    if (
      typeof input[key] !== "string" ||
      input[key].trim().length < 2 ||
      input[key].trim().length > 60
    )
      fields[key] = "Use de 2 a 60 caracteres.";
  const username = usernameProblem(input.username ?? "");
  if (username) fields.username = username;
  const email = emailProblem(input.email ?? "");
  if (email) fields.email = email;
  if (
    typeof input.referralCode !== "string" ||
    !/^[a-zA-Z0-9_-]{3,32}$/.test(input.referralCode.trim())
  )
    fields.referralCode = "Use de 3 a 32 letras, números, hífen ou sublinhado.";
  if (typeof input.ens !== "string" || !validEns(input.ens.trim()))
    fields.ens = "Informe um ENS válido ou deixe vazio.";
  if (
    typeof input.secondaryReference !== "string" ||
    (input.secondaryReference.trim() &&
      !validEns(input.secondaryReference.trim()) &&
      !validAddress(input.secondaryReference.trim(), network))
  )
    fields.secondaryReference = "Informe ENS ou endereço válido para a rede.";
  if (typeof input.note !== "string" || input.note.length > 500)
    fields.note = "Use até 500 caracteres.";
  return fields;
}
