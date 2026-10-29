export function safeReturnTo(value: unknown, fallback = "/account"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return fallback;
  try {
    const url = new URL(value, location.origin);
    if (
      url.origin !== location.origin ||
      !/^(?:\/$|\/nfts\/[^/]+$|\/account(?:\/(?:profile|wallets|favorites))?$|\/checkout$|\/cart$|\/orders(?:\/[^/]+)?$)/.test(
        url.pathname,
      )
    )
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
export function parseAuthSearch(input: Record<string, unknown>) {
  return {
    redirect: safeReturnTo(input.redirect),
    reason: input.reason === "expired" ? ("expired" as const) : ("" as const),
  };
}
export function parseAccountSearch(input: Record<string, unknown>) {
  return {
    accountScenario:
      input.accountScenario === "slow"
        ? ("slow" as const)
        : ("default" as const),
  };
}
