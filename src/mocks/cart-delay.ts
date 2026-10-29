// Controle de latência do mock: pausa a resposta sem pausar o JavaScript da aba.
const prefix = "kurio.mock.cart-hold.";
const waiting = new Map<
  string,
  { promise: Promise<void>; release: () => void }
>();
const channel = new BroadcastChannel("kurio-cart-delay");
function resolveLocal(id: string) {
  waiting.get(id)?.release();
  waiting.delete(id);
}
channel.addEventListener("message", (event) => {
  if (event.data === "reset") {
    for (const id of waiting.keys()) resolveLocal(id);
  } else resolveLocal(String(event.data));
});
export function holdCart(owner: string) {
  const old = localStorage.getItem(prefix + "owner:" + owner);
  if (old) releaseCart(old);
  const id = crypto.randomUUID();
  localStorage.setItem(prefix + "ticket:" + id, "waiting");
  localStorage.setItem(prefix + "owner:" + owner, id);
  return id;
}
export async function waitCart(owner: string) {
  const id = localStorage.getItem(prefix + "owner:" + owner);
  if (!id || !localStorage.getItem(prefix + "ticket:" + id)) return;
  localStorage.setItem(prefix + "ticket:" + id, "held");
  if (!waiting.has(id)) {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    waiting.set(id, { promise, release });
  }
  await waiting.get(id)!.promise;
}
export function releaseCart(id: string) {
  if (!localStorage.getItem(prefix + "ticket:" + id)) return false;
  localStorage.removeItem(prefix + "ticket:" + id);
  for (const key of Object.keys(localStorage))
    if (key.startsWith(prefix + "owner:") && localStorage.getItem(key) === id)
      localStorage.removeItem(key);
  resolveLocal(id);
  channel.postMessage(id);
  return true;
}
export function resetCartGates() {
  for (const key of Object.keys(localStorage))
    if (key.startsWith(prefix)) localStorage.removeItem(key);
  for (const id of waiting.keys()) resolveLocal(id);
  channel.postMessage("reset");
}

export function cartGateState(id: string) {
  return localStorage.getItem(prefix + "ticket:" + id);
}
