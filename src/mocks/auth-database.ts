import { mergeGuestCart } from "./cart-store";
import type { Wallet } from "../features/account/contracts";
import type { Session, User } from "../features/auth/contracts";
export const databaseKey = "kurio.mock.database.v1";
const cookieName = "kurio.mock.session";
const iterations = 120000;
export const sessionDuration = 15 * 60 * 1000;
interface StoredUser extends User {
  salt: string;
  hash: string;
  iterations: number;
  displayName?: string;
  walletNickname?: string;
  ens?: string;
  avatar?: string | null;
  profileVersion?: number;
}
interface StoredSession {
  token: string;
  userId: string;
  expiresAt: number;
}
interface Database {
  version: 1;
  users: StoredUser[];
  sessions: StoredSession[];
  favorites: Record<string, { ids: string[]; version: number }>;
  wallets: Record<string, Wallet[]>;
}
const seeds: StoredUser[] = [
  {
    id: "nova",
    username: "gabriel_usuario",
    email: "gabriel@kurio.test",
    createdAt: "2026-09-01T12:00:00.000Z",
    salt: "9c381eab74d021b53b2f56719fa012cd",
    hash: "e4dc9bb0d196a30c8d8bc4a016a20a777d5b37d4d37b5e0423d0a7cfc3673740",
    iterations,
  },
  {
    id: "leo",
    username: "super_mario",
    email: "mario@kurio.test",
    createdAt: "2026-09-02T12:00:00.000Z",
    salt: "b1e06a3d24c89f0a657d93b81e4205fc",
    hash: "bfeaf8ca3bc7f21533db6b34fa5576d271767ae1f2007ce33a00d3883affaef2",
    iterations,
  },
];
export function loadDatabase(): Database {
  try {
    const value: Database = JSON.parse(
      localStorage.getItem(databaseKey) ?? "null",
    );
    if (
      value?.version === 1 &&
      Array.isArray(value.users) &&
      value.users.every(
        (user) =>
          typeof user.id === "string" &&
          typeof user.hash === "string" &&
          typeof user.salt === "string",
      ) &&
      Array.isArray(value.sessions)
    ) {
      value.favorites ??= {};
      value.wallets ??= {};
      return value;
    }
  } catch {
    /* Estado local inválido volta à fixture conhecida. */
  }
  const db: Database = {
    version: 1,
    users: structuredClone(seeds),
    sessions: [],
    favorites: {},
    wallets: {},
  };
  saveDatabase(db);
  return db;
}
export function saveDatabase(db: Database) {
  localStorage.setItem(databaseKey, JSON.stringify(db));
}
function cookie(token: string, maxAge: number) {
  document.cookie = `${cookieName}=${encodeURIComponent(token)}; Path=/; SameSite=Strict; Max-Age=${maxAge}${location.protocol === "https:" ? "; Secure" : ""}`;
}
export function readToken() {
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1) ?? ""
  );
}
export function publicUser(user: StoredUser): User {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}
export function inspectSession() {
  const db = loadDatabase(),
    token = readToken();
  const stored = db.sessions.find((session) => session.token === token);
  const user = db.users.find((candidate) => candidate.id === stored?.userId);
  return {
    db,
    token,
    stored,
    user,
    valid: !!stored && !!user && stored.expiresAt > Date.now(),
  };
}
export function clearSession() {
  const { db, token } = inspectSession();
  db.sessions = db.sessions.filter((session) => session.token !== token);
  saveDatabase(db);
  cookie("", 0);
}
export function createSession(user: StoredUser): Session {
  const { db, token } = inspectSession();
  const stored = {
    token: crypto.randomUUID(),
    userId: user.id,
    expiresAt: Date.now() + sessionDuration,
  };
  db.sessions = db.sessions.filter(
    (session) => session.token !== token && session.expiresAt > Date.now(),
  );
  db.sessions.push(stored);
  saveDatabase(db);
  mergeGuestCart(user.id);
  cookie(stored.token, 86400);
  return {
    user: publicUser(user),
    expiresAt: new Date(stored.expiresAt).toISOString(),
  };
}
export function resetAuthDatabase() {
  localStorage.removeItem(databaseKey);
  cookie("", 0);
  loadDatabase();
}
export async function passwordHash(
  password: string,
  salt: string,
  rounds = iterations,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bytes = Uint8Array.from(salt.match(/.{2}/g) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: bytes, iterations: rounds },
    key,
    256,
  );
  return [...new Uint8Array(bits)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
export async function storedUser(input: {
  username: string;
  email: string;
  password: string;
}): Promise<StoredUser> {
  const salt = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return {
    id: crypto.randomUUID(),
    username: input.username.trim(),
    email: input.email.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    salt,
    hash: await passwordHash(input.password, salt),
    iterations,
  };
}
