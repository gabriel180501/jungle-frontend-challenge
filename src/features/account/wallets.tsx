import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { queryClient } from "../../app/query-client";
import { Button } from "../../components/ui/button";
import { networks } from "../catalog/contracts";
import { useAuth } from "../auth/context";
import { profileOptions, saveWallet, walletsKey, walletsOptions } from "./api";
import {
  walletTypes,
  type AccountError,
  type Profile,
  type Wallet,
  type WalletInput,
  type WalletRole,
} from "./contracts";
import { validateWallet } from "./validation";
import { Field, SelectField } from "./field";
import { focusError } from "./form-utils";
export function WalletsPanel() {
  const userId = useAuth().user?.id;
  const profile = useQuery(profileOptions(userId)),
    query = useQuery(walletsOptions(userId));
  const [editing, setEditing] = useState<WalletRole | null>(null);
  const [success, setSuccess] = useState("");
  if (!userId) return null;
  if (profile.isPending || query.isPending)
    return (
      <div
        className="skeleton account-skeleton"
        role="status"
        aria-label="Carregando carteiras"
      />
    );
  if (profile.isError || query.isError)
    return (
      <div role="alert">
        <p>Não foi possível carregar as carteiras.</p>
        <Button
          onClick={() => {
            void profile.refetch();
            void query.refetch();
          }}
        >
          Tentar novamente
        </Button>
      </div>
    );
  const primary = query.data.items.find((wallet) => wallet.role === "primary");
  return (
    <div className="wallets-panel">
      <p className="account-intro">
        Estas carteiras ficam disponíveis no pagamento e para receber NFTs
        comprados na simulação.
      </p>
      {success && (
        <p className="account-feedback" role="status">
          {success}
        </p>
      )}
      {(["primary", "secondary"] as const).map((role) => {
        const wallet = query.data.items.find((item) => item.role === role);
        const showForm = (!wallet && role === "primary") || editing === role;
        return (
          <section className="wallet-section" key={role}>
            <div className="wallet-section-heading">
              <h2>
                {role === "primary"
                  ? "Carteira principal"
                  : "Carteira secundária"}
              </h2>
              {wallet && editing !== role && (
                <button
                  onClick={() => {
                    setEditing(role);
                    setSuccess("");
                  }}
                >
                  Editar carteira{" "}
                  {role === "primary" ? "principal" : "secundária"}
                </button>
              )}
            </div>
            {showForm ? (
              <WalletForm
                key={`${wallet?.id ?? role}:${wallet?.version ?? 0}`}
                profile={profile.data}
                wallet={wallet}
                primary={primary}
                role={role}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null);
                  setSuccess(
                    role === "primary"
                      ? "Carteira principal salva."
                      : "Carteira secundária salva.",
                  );
                }}
              />
            ) : wallet ? (
              <dl className="wallet-details">
                <div>
                  <dt>Apelido</dt>
                  <dd>{wallet.nickname}</dd>
                </div>
                <div>
                  <dt>Rede e tipo</dt>
                  <dd>
                    {wallet.network} · {wallet.walletType}
                  </dd>
                </div>
                <div className="full-width">
                  <dt>Endereço</dt>
                  <dd>{wallet.address}</dd>
                </div>
                <div>
                  <dt>E-mail</dt>
                  <dd>{wallet.email}</dd>
                </div>
                <div>
                  <dt>Nome de exibição</dt>
                  <dd>{wallet.displayName}</dd>
                </div>
                {wallet.ens && (
                  <div>
                    <dt>ENS</dt>
                    <dd>{wallet.ens}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <>
                <p className="account-note">
                  Você ainda não adicionou uma carteira secundária.
                </p>
                <Button
                  variant="outline"
                  disabled={!primary}
                  onClick={() => {
                    setEditing("secondary");
                    setSuccess("");
                  }}
                >
                  Adicionar carteira secundária
                </Button>
                {!primary && (
                  <p className="account-hint">
                    Salve a carteira principal primeiro.
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
function WalletForm({
  profile,
  wallet,
  primary,
  role,
  onCancel,
  onSaved,
}: {
  profile: Profile;
  wallet?: Wallet;
  primary?: Wallet;
  role: WalletRole;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<WalletInput>(
    wallet ?? {
      role,
      displayName: profile.displayName,
      nickname: role === "primary" ? profile.walletNickname : "Reserva",
      profileName: profile.username,
      referralCode: "",
      email: profile.email,
      ens: profile.ens,
      secondaryReference: "",
      network: "Ethereum",
      address: "",
      walletType: "" as WalletInput["walletType"],
    },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const save = useMutation({
    mutationFn: (input: WalletInput) =>
      saveWallet(profile.id, {
        ...input,
        id: wallet?.id,
        version: wallet?.version,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: walletsKey(profile.id) });
      onSaved();
    },
  });
  function change(key: keyof WalletInput, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const fields = validateWallet(draft);
    setErrors(fields);
    save.reset();
    if (Object.keys(fields).length) {
      focusError(form.current, fields);
      return;
    }
    try {
      await save.mutateAsync(draft);
    } catch (error) {
      if (isAxiosError<AccountError>(error) && error.response?.data.fields) {
        setErrors(error.response.data.fields);
        focusError(form.current, error.response.data.fields);
      }
    }
  }
  const field = (
    key: keyof WalletInput,
    label: string,
    placeholder?: string,
  ) => (
    <Field
      key={key}
      label={label}
      name={key}
      value={draft[key]}
      error={errors[key]}
      disabled={save.isPending}
      maxLength={key === "email" ? 254 : 120}
      placeholder={placeholder}
      onChange={(event) => change(key, event.target.value)}
    />
  );
  return (
    <form
      ref={form}
      aria-label={
        role === "primary" ? "Carteira principal" : "Carteira secundária"
      }
      onSubmit={(event) => void submit(event)}
      className="wallet-form"
      noValidate
    >
      {role === "secondary" && primary && (
        <div className="copy-wallet">
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() =>
              setDraft((previous) => ({
                ...previous,
                displayName: primary.displayName,
                email: primary.email,
                profileName: primary.profileName,
                referralCode: primary.referralCode,
                ens: primary.ens,
              }))
            }
          >
            Usar dados da carteira principal
          </Button>
          <p className="account-hint">
            Copia a identificação; informe o endereço da carteira secundária.
          </p>
        </div>
      )}
      <div className="account-form-grid">
        {field("displayName", "Nome de exibição")}
        {field("nickname", "Apelido da carteira")}
        <SelectField
          label="Rede"
          name="network"
          value={draft.network}
          disabled={save.isPending}
          error={errors.network}
          onChange={(event) => change("network", event.target.value)}
        >
          {networks.map((network) => (
            <option key={network}>{network}</option>
          ))}
        </SelectField>
        {field("profileName", "Nome do perfil")}
        {field(
          "address",
          "Endereço da carteira",
          draft.network === "Solana" ? "Endereço Solana" : "0x…",
        )}
        {field("secondaryReference", "ENS ou carteira secundária (opcional)")}
        <SelectField
          label="Tipo de carteira"
          name="walletType"
          value={draft.walletType}
          disabled={save.isPending}
          error={errors.walletType}
          onChange={(event) => change("walletType", event.target.value)}
        >
          <option value="">Selecione uma carteira</option>
          {walletTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </SelectField>
        {field("referralCode", "Código de indicação", "Ex.: KURIO2026")}
        {field("email", "E-mail")}
        {field("ens", "Nome ENS (opcional)", "colecionador.eth")}
      </div>
      {save.isError && (
        <p className="account-feedback error" role="alert">
          {isAxiosError<AccountError>(save.error)
            ? (save.error.response?.data.message ??
              "Não foi possível salvar a carteira.")
            : "Não foi possível salvar a carteira."}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending
            ? "Salvando…"
            : role === "primary"
              ? "Salvar carteira principal"
              : "Salvar carteira secundária"}
        </Button>
        {(wallet || role === "secondary") && (
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
