import { delay, http, HttpResponse } from "msw";
import { validateAuth } from "../features/auth/validation";
import type { AuthInput, AuthError } from "../features/auth/contracts";
import {
  clearSession,
  createSession,
  inspectSession,
  loadDatabase,
  passwordHash,
  publicUser,
  resetAuthDatabase,
  saveDatabase,
  storedUser,
} from "./auth-database";
let operation = 0;
export function resetAuthScenarios() {
  operation += 1;
  resetAuthDatabase();
}
const error = (
  code: string,
  message: string,
  status: number,
  fields?: AuthError["fields"],
) => HttpResponse.json<AuthError>({ code, message, fields }, { status });
function requireUser() {
  const session = inspectSession();
  return session.valid ? session : null;
}
function denied() {
  const session = inspectSession();
  const expired = !!session.token;
  clearSession();
  return error(
    expired ? "SESSION_EXPIRED" : "UNAUTHENTICATED",
    expired
      ? "Sua sessão expirou. Entre novamente."
      : "Entre para acessar esta página.",
    401,
  );
}
export const authHandlers = [
  http.get("/api/session", async () => {
    await delay(150);
    const session = inspectSession();
    if (!session.token)
      return HttpResponse.json({ user: null, expiresAt: null });
    if (!session.valid || !session.user || !session.stored) return denied();
    return HttpResponse.json({
      user: publicUser(session.user),
      expiresAt: new Date(session.stored.expiresAt).toISOString(),
    });
  }),
  http.post("/api/auth/login", async ({ request }) => {
    const currentOperation = ++operation;
    await delay(180);
    const body = (await request.json()) as Partial<AuthInput>;
    const input: AuthInput = {
      username: "",
      confirmPassword: "",
      email: typeof body?.email === "string" ? body.email : "",
      password: typeof body?.password === "string" ? body.password : "",
    };
    const fields = validateAuth(input, false);
    if (Object.keys(fields).length)
      return error("VALIDATION_ERROR", "Revise os campos.", 422, fields);
    const user = loadDatabase().users.find(
      (candidate) => candidate.email === input.email.trim().toLowerCase(),
    );
    const hash = await passwordHash(
      input.password,
      user?.salt ?? "9c381eab74d021b53b2f56719fa012cd",
      user?.iterations,
    );
    if (currentOperation !== operation)
      return error("AUTH_SUPERSEDED", "Esta tentativa foi substituída.", 409);
    if (!user || user.hash !== hash)
      return error("INVALID_CREDENTIALS", "E-mail ou senha incorretos.", 401);
    return HttpResponse.json(createSession(user));
  }),
  http.post("/api/auth/register", async ({ request }) => {
    const currentOperation = ++operation;
    await delay(180);
    const body = (await request.json()) as Partial<AuthInput>;
    const input: AuthInput = {
      username: typeof body?.username === "string" ? body.username : "",
      email: typeof body?.email === "string" ? body.email : "",
      password: typeof body?.password === "string" ? body.password : "",
      confirmPassword:
        typeof body?.confirmPassword === "string" ? body.confirmPassword : "",
    };
    const fields = validateAuth(input, true);
    if (Object.keys(fields).length)
      return error("VALIDATION_ERROR", "Revise os campos.", 422, fields);
    const user = await storedUser(input);
    if (currentOperation !== operation)
      return error("AUTH_SUPERSEDED", "Esta tentativa foi substituída.", 409);
    const db = loadDatabase();
    if (db.users.some((candidate) => candidate.email === user.email))
      return error(
        "ACCOUNT_CONFLICT",
        "Este e-mail já possui uma conta.",
        409,
        { email: "Este e-mail já possui uma conta." },
      );
    if (
      db.users.some(
        (candidate) =>
          candidate.username.toLowerCase() === user.username.toLowerCase(),
      )
    )
      return error(
        "ACCOUNT_CONFLICT",
        "Este nome de usuário já está em uso.",
        409,
        { username: "Este nome de usuário já está em uso." },
      );
    db.users.push(user);
    saveDatabase(db);
    return HttpResponse.json(createSession(user), { status: 201 });
  }),
  http.post("/api/auth/logout", async () => {
    operation += 1;
    await delay(100);
    clearSession();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/api/account", async ({ request }) => {
    const original = requireUser();
    if (!original) return denied();
    await delay(
      new URL(request.url).searchParams.get("accountScenario") === "slow"
        ? 1800
        : 200,
    );
    const current = inspectSession();
    if (original.token !== current.token)
      return error(
        "SESSION_CHANGED",
        "A sessão mudou durante a consulta.",
        409,
      );
    if (!current.valid || !current.user) return denied();
    return HttpResponse.json(publicUser(current.user));
  }),
  http.post("/api/demo/session/expire", () => {
    const session = inspectSession();
    if (!session.stored) return denied();
    session.stored.expiresAt = Date.now() - 1;
    saveDatabase(session.db);
    return new HttpResponse(null, { status: 204 });
  }),
];
