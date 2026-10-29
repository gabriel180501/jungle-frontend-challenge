// Valores em ETH são strings. BigInt evita arredondamento em filtros e ordenação.
export function isEth(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,12}(?:\.\d{1,18})?$/.test(value);
}
export function ethToWei(value: string): bigint {
  if (!isEth(value)) throw new Error("Valor ETH inválido");
  const [integer, decimal = ""] = value.split(".");
  return BigInt(integer) * 10n ** 18n + BigInt(decimal.padEnd(18, "0"));
}
export function formatEth(value: string): string {
  if (!isEth(value)) throw new Error("Valor ETH inválido");
  const [integer, decimal = ""] = value.split(".");
  return `${BigInt(integer).toString()},${decimal.replace(/0+$/, "").padEnd(2, "0")}`;
}

export function multiplyEth(price: string, quantity: number): string {
  if (!Number.isSafeInteger(quantity) || quantity < 0)
    throw new Error("Quantidade inválida");
  const total = ethToWei(price) * BigInt(quantity);
  const integer = total / 10n ** 18n;
  const fraction = (total % 10n ** 18n)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer.toString();
}

export function weiToEth(value: bigint): string {
  if (value < 0n) throw new Error("Valor negativo");
  const scale = 10n ** 18n;
  const fraction = (value % scale)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "");
  return `${value / scale}${fraction ? `.${fraction}` : ""}`;
}
