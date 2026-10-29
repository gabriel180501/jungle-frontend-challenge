import { getNftDetail } from "./fixtures/nft-details";
import { delay, http, HttpResponse } from "msw";
import {
  inspectSession,
  clearSession,
  passwordHash,
  publicUser,
  saveDatabase,
} from "./auth-database";
import { nftFixtures } from "./fixtures/nfts";
import type {
  AccountError,
  PasswordInput,
  Profile,
  ProfileInput,
  Wallet,
  WalletInput,
  FavoritesResponse,
} from "../features/account/contracts";
import {
  validatePassword,
  validateProfile,
  validateWallet,
} from "../features/account/validation";
const favoriteScenarios = new Map<
  string,
  { mode: "default" | "slow" | "fail-once"; failed: boolean }
>();
export function resetAccountScenarios() {
  favoriteScenarios.clear();
}
const error = (
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string>,
) => HttpResponse.json<AccountError>({ code, message, fields }, { status });
function authorized(originalToken?: string) {
  const current = inspectSession();
  if (originalToken && current.token !== originalToken)
    return {
      response: error(
        "SESSION_CHANGED",
        "Sua sessão mudou durante a operação.",
        409,
      ),
      session: null,
    };
  if (!current.valid || !current.user) {
    const expired = !!current.token;
    clearSession();
    return {
      response: error(
        expired ? "SESSION_EXPIRED" : "UNAUTHENTICATED",
        "Entre novamente para continuar.",
        401,
      ),
      session: null,
    };
  }
  return {
    session: current as typeof current & {
      user: NonNullable<typeof current.user>;
    },
    response: null,
  };
}
function profile(
  user: NonNullable<ReturnType<typeof inspectSession>["user"]>,
): Profile {
  return {
    ...publicUser(user),
    displayName:
      user.displayName ??
      (user.id === "nova"
        ? "Gabriel"
        : user.id === "leo"
          ? "Mario Bros"
          : user.username),
    walletNickname: user.walletNickname ?? "Principal",
    ens: user.ens ?? "",
    avatar: user.avatar ?? null,
    version: user.profileVersion ?? 1,
  };
}
function persist(db: Parameters<typeof saveDatabase>[0]) {
  try {
    saveDatabase(db);
    return null;
  } catch {
    return error(
      "STORAGE_FULL",
      "Não foi possível salvar no armazenamento da demonstração. Remova um avatar ou restaure o cenário.",
      507,
    );
  }
}
function favoriteData(
  userId: string,
  db = inspectSession().db,
): FavoritesResponse {
  const state = db.favorites[userId] ?? { ids: [], version: 1 };
  const items = state.ids.flatMap((id) => {
    const nft = nftFixtures.find((item) => item.id === id),
      live = getNftDetail(id);
    return nft && live
      ? [
          {
            ...nft,
            price: live.price,
            available: live.available,
            version: live.version,
          },
        ]
      : [];
  });
  return {
    userId,
    ids: items.map((nft) => nft.id),
    items,
    version: state.version,
  };
}
async function mutateFavorite(request: Request, id: string, favorite: boolean) {
  const initial = authorized();
  if (!initial.session) return initial.response!;
  const userId = initial.session.user.id;
  const scenario = favoriteScenarios.get(userId);
  await delay(scenario?.mode === "slow" ? 1500 : 300);
  const access = authorized(initial.session.token);
  if (!access.session) return access.response!;
  if (!nftFixtures.some((nft) => nft.id === id))
    return error("NOT_FOUND", "NFT não encontrado.", 404);
  if (scenario?.mode === "fail-once" && !scenario.failed) {
    scenario.failed = true;
    return error(
      "TRANSIENT_FAILURE",
      "Não foi possível salvar o favorito. Tente novamente.",
      503,
    );
  }
  if (request.signal.aborted)
    return error("REQUEST_CANCELLED", "Operação cancelada.", 409);
  const state = access.session.db.favorites[userId] ?? { ids: [], version: 1 };
  const ids = favorite
    ? [...new Set([...state.ids, id])]
    : state.ids.filter((value) => value !== id);
  access.session.db.favorites[userId] = { ids, version: state.version + 1 };
  const failure = persist(access.session.db);
  return (
    failure ??
    HttpResponse.json<FavoritesResponse>(
      favoriteData(userId, access.session.db),
    )
  );
}
export const accountHandlers = [
  http.get("/api/profile", async ({ request }) => {
    await delay(
      new URL(request.url).searchParams.get("accountScenario") === "slow"
        ? 1800
        : 200,
    );
    const access = authorized();
    return access.session
      ? HttpResponse.json(profile(access.session.user))
      : access.response!;
  }),
  http.put("/api/profile", async ({ request }) => {
    const initial = authorized();
    if (!initial.session) return initial.response!;
    const body = (await request.json()) as ProfileInput & { version: number };
    if (
      !body ||
      ["displayName", "username", "email", "walletNickname", "ens"].some(
        (key) => typeof body[key as keyof ProfileInput] !== "string",
      )
    )
      return error("VALIDATION_ERROR", "Revise os dados do perfil.", 422);
    const fields = validateProfile(body);
    if (Object.keys(fields).length)
      return error(
        "VALIDATION_ERROR",
        "Revise os campos do perfil.",
        422,
        fields,
      );
    await delay(250);
    const access = authorized(initial.session.token);
    if (!access.session) return access.response!;
    const user = access.session.user;
    if ((user.profileVersion ?? 1) !== body.version)
      return error(
        "PROFILE_CHANGED",
        "O perfil foi alterado em outra aba. Recarregue os dados.",
        409,
      );
    const otherUsers = access.session.db.users.filter(
      (candidate) => candidate.id !== user.id,
    );
    if (
      otherUsers.some(
        (candidate) => candidate.email === body.email.trim().toLowerCase(),
      )
    )
      return error(
        "ACCOUNT_CONFLICT",
        "Este e-mail já possui uma conta.",
        409,
        { email: "Este e-mail já possui uma conta." },
      );
    if (
      otherUsers.some(
        (candidate) =>
          candidate.username.toLowerCase() ===
          body.username.trim().toLowerCase(),
      )
    )
      return error(
        "ACCOUNT_CONFLICT",
        "Este nome de usuário já está em uso.",
        409,
        { username: "Este nome de usuário já está em uso." },
      );
    Object.assign(user, {
      displayName: body.displayName.trim(),
      username: body.username.trim(),
      email: body.email.trim().toLowerCase(),
      walletNickname: body.walletNickname.trim(),
      ens: body.ens.trim().toLowerCase(),
      avatar: body.avatar,
      profileVersion: body.version + 1,
    });
    const failure = persist(access.session.db);
    return failure ?? HttpResponse.json(profile(user));
  }),
  http.put("/api/profile/password", async ({ request }) => {
    const initial = authorized();
    if (!initial.session) return initial.response!;
    const input = (await request.json()) as PasswordInput;
    if (
      !input ||
      ["currentPassword", "newPassword", "confirmPassword"].some(
        (key) => typeof input[key as keyof PasswordInput] !== "string",
      )
    )
      return error("VALIDATION_ERROR", "Revise os campos da senha.", 422);
    const fields = validatePassword(input);
    if (Object.keys(fields).length)
      return error(
        "VALIDATION_ERROR",
        "Revise os campos da senha.",
        422,
        fields,
      );
    const expected = initial.session.user.hash;
    const actual = await passwordHash(
      input.currentPassword,
      initial.session.user.salt,
      initial.session.user.iterations,
    );
    if (actual !== expected)
      return error("INVALID_PASSWORD", "A senha atual está incorreta.", 422, {
        currentPassword: "A senha atual está incorreta.",
      });
    const salt = [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const hash = await passwordHash(input.newPassword, salt, 120000);
    const access = authorized(initial.session.token);
    if (!access.session) return access.response!;
    if (access.session.user.hash !== expected)
      return error(
        "PASSWORD_CHANGED",
        "A senha foi alterada durante a operação. Tente novamente.",
        409,
      );
    Object.assign(access.session.user, { hash, salt, iterations: 120000 });
    access.session.db.sessions = access.session.db.sessions.filter(
      (session) =>
        session.userId !== access.session.user.id ||
        session.token === access.session.token,
    );
    const failure = persist(access.session.db);
    return failure ?? new HttpResponse(null, { status: 204 });
  }),
  http.get("/api/wallets", async () => {
    await delay(200);
    const access = authorized();
    return access.session
      ? HttpResponse.json({
          userId: access.session.user.id,
          items: access.session.db.wallets[access.session.user.id] ?? [],
        })
      : access.response!;
  }),
  http.post<Record<string, never>, WalletInput, Wallet | AccountError>(
    "/api/wallets",
    async ({ request }) => saveWallet(request),
  ),
  http.put<{ id: string }, WalletInput, Wallet | AccountError>(
    "/api/wallets/:id",
    async ({ request, params }) => saveWallet(request, String(params.id)),
  ),
  http.get("/api/favorites", async () => {
    await delay(180);
    const access = authorized();
    return access.session
      ? HttpResponse.json(
          favoriteData(access.session.user.id, access.session.db),
        )
      : access.response!;
  }),
  http.put<{ id: string }, undefined, FavoritesResponse | AccountError>(
    "/api/favorites/:id",
    async ({ request, params }) =>
      mutateFavorite(request, String(params.id), true),
  ),
  http.delete<{ id: string }, undefined, FavoritesResponse | AccountError>(
    "/api/favorites/:id",
    async ({ request, params }) =>
      mutateFavorite(request, String(params.id), false),
  ),
  http.post("/api/demo/favorites/scenario", async ({ request }) => {
    const access = authorized();
    if (!access.session) return access.response!;
    const { mode } = (await request.json()) as { mode: string };
    if (!["default", "slow", "fail-once"].includes(mode))
      return error("VALIDATION_ERROR", "Cenário inválido.", 422);
    favoriteScenarios.set(access.session.user.id, {
      mode: mode as "default" | "slow" | "fail-once",
      failed: false,
    });
    return new HttpResponse(null, { status: 204 });
  }),
];
async function saveWallet(request: Request, id?: string) {
  const initial = authorized();
  if (!initial.session) return initial.response!;
  const body = (await request.json()) as WalletInput & { version?: number };
  const keys = [
    "role",
    "displayName",
    "nickname",
    "profileName",
    "referralCode",
    "email",
    "ens",
    "secondaryReference",
    "network",
    "address",
    "walletType",
  ] as const;
  if (!body || keys.some((key) => typeof body[key] !== "string"))
    return error("VALIDATION_ERROR", "Revise os dados da carteira.", 422);
  const fields = validateWallet(body);
  if (!["primary", "secondary"].includes(body.role))
    fields.role = "Tipo de carteira inválido.";
  if (Object.keys(fields).length)
    return error(
      "VALIDATION_ERROR",
      "Revise os campos da carteira.",
      422,
      fields,
    );
  await delay(250);
  const access = authorized(initial.session.token);
  if (!access.session) return access.response!;
  const userId = access.session.user.id,
    items = access.session.db.wallets[userId] ?? [];
  const old = items.find((wallet) => wallet.id === id);
  if (id && !old) {
    const foreign = Object.values(access.session.db.wallets).some((items) =>
      items.some((wallet) => wallet.id === id),
    );
    return foreign
      ? error(
          "FORBIDDEN",
          "Você não tem permissão para alterar esta carteira.",
          403,
        )
      : error("NOT_FOUND", "Carteira não encontrada para esta conta.", 404);
  }
  if (old && (old.version !== body.version || old.role !== body.role))
    return error(
      "WALLET_CHANGED",
      "A carteira foi alterada. Recarregue os dados.",
      409,
    );
  if (!id && items.some((wallet) => wallet.role === body.role))
    return error(
      "ROLE_CONFLICT",
      "Já existe uma carteira com esta função.",
      409,
    );
  if (
    body.role === "secondary" &&
    !items.some((wallet) => wallet.role === "primary")
  )
    return error(
      "PRIMARY_REQUIRED",
      "Cadastre a carteira principal primeiro.",
      409,
    );
  const address =
    body.network === "Solana"
      ? body.address.trim()
      : body.address.trim().toLowerCase();
  if (
    items.some(
      (wallet) =>
        wallet.id !== id &&
        wallet.network === body.network &&
        wallet.address === address,
    )
  )
    return error(
      "WALLET_CONFLICT",
      "Este endereço já está cadastrado nesta rede.",
      409,
      { address: "Este endereço já está cadastrado nesta rede." },
    );
  const wallet: Wallet = {
    id: old?.id ?? crypto.randomUUID(),
    userId,
    role: body.role,
    displayName: body.displayName.trim(),
    nickname: body.nickname.trim(),
    profileName: body.profileName.trim(),
    referralCode: body.referralCode.trim(),
    email: body.email.trim().toLowerCase(),
    ens: body.ens.trim().toLowerCase(),
    secondaryReference: body.secondaryReference.trim(),
    network: body.network,
    address,
    walletType: body.walletType,
    version: (old?.version ?? 0) + 1,
  };
  access.session.db.wallets[userId] = [
    ...items.filter((item) => item.id !== id),
    wallet,
  ];
  const failure = persist(access.session.db);
  return (
    failure ?? HttpResponse.json<Wallet>(wallet, { status: old ? 200 : 201 })
  );
}
