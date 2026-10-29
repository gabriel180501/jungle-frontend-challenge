import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ImagePlus } from "lucide-react";
import { queryClient } from "../../app/query-client";
import { Button } from "../../components/ui/button";
import { refreshIdentity } from "../auth/service";
import { profileKey, updatePassword, updateProfile } from "./api";
import type {
  AccountError,
  PasswordInput,
  Profile,
  ProfileInput,
} from "./contracts";
import { avatarProblem, validatePassword, validateProfile } from "./validation";
import { Field } from "./field";
import { focusError } from "./form-utils";
export function ProfileForm({
  profile,
  reload,
}: {
  profile: Profile;
  reload: () => void;
}) {
  const [draft, setDraft] = useState<ProfileInput>(profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageError, setImageError] = useState("");
  const [reading, setReading] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const save = useMutation({
    mutationFn: (input: ProfileInput) =>
      updateProfile(profile.id, { ...input, version: profile.version }),
    onSuccess: async (data) => {
      setDraft(data);
      queryClient.setQueryData(profileKey(profile.id), data);
      await queryClient.invalidateQueries({
        queryKey: ["private", profile.id, "account"],
      });
      await refreshIdentity();
    },
  });
  const [saved, setSaved] = useState(false);
  function change(key: keyof ProfileInput, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  }
  async function upload(selected?: File) {
    setImageError("");
    if (!selected) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(selected.type) ||
      selected.size > 512 * 1024
    ) {
      setImageError("Use PNG, JPEG ou WebP de até 512 KB.");
      return;
    }
    setReading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(selected);
      });
      const problem = avatarProblem(data);
      if (problem) throw new Error(problem);
      const image = new Image();
      image.src = data;
      await image.decode();
      setDraft((previous) => ({ ...previous, avatar: data }));
      setSaved(false);
    } catch {
      setImageError(
        "Não foi possível ler a imagem. Escolha um arquivo válido.",
      );
    } finally {
      setReading(false);
      if (file.current) file.current.value = "";
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (save.isPending || reading) return;
    const fields = validateProfile(draft);
    setErrors(fields);
    setSaved(false);
    if (Object.keys(fields).length) {
      focusError(form.current, fields);
      return;
    }
    try {
      await save.mutateAsync(draft);
      setSaved(true);
    } catch (error) {
      if (isAxiosError<AccountError>(error) && error.response?.data.fields) {
        setErrors(error.response.data.fields);
        focusError(form.current, error.response.data.fields);
      }
    }
  }
  const serverError = isAxiosError<AccountError>(save.error)
    ? (save.error.response?.data.message ?? "Não foi possível salvar o perfil.")
    : "";
  return (
    <>
      <form
        ref={form}
        className="profile-form"
        aria-label="Dados do perfil"
        onSubmit={(event) => void submit(event)}
        noValidate
        aria-busy={save.isPending}
      >
        <h2>Dados do perfil</h2>
        <div className="account-form-grid">
          <Field
            label="Nome de exibição"
            name="displayName"
            value={draft.displayName}
            maxLength={60}
            error={errors.displayName}
            disabled={save.isPending}
            onChange={(e) => change("displayName", e.target.value)}
          />
          <Field
            label="Nome de usuário"
            name="username"
            value={draft.username}
            maxLength={24}
            error={errors.username}
            disabled={save.isPending}
            onChange={(e) => change("username", e.target.value)}
          />
          <Field
            label="E-mail"
            name="email"
            type="email"
            value={draft.email}
            maxLength={254}
            error={errors.email}
            disabled={save.isPending}
            onChange={(e) => change("email", e.target.value)}
          />
          <Field
            label="Nome ENS (opcional)"
            name="ens"
            value={draft.ens}
            placeholder="colecionador.eth"
            error={errors.ens}
            disabled={save.isPending}
            onChange={(e) => change("ens", e.target.value)}
          />
          <Field
            label="Apelido da carteira"
            name="walletNickname"
            value={draft.walletNickname}
            maxLength={30}
            error={errors.walletNickname}
            disabled={save.isPending}
            onChange={(e) => change("walletNickname", e.target.value)}
          />
          <div className="avatar-field">
            <label htmlFor="profile-avatar">Avatar</label>
            <div>
              {draft.avatar ? (
                <img
                  src={draft.avatar}
                  alt="Prévia do avatar"
                  width="64"
                  height="64"
                />
              ) : (
                <span className="avatar-placeholder" aria-label="Sem avatar">
                  <ImagePlus size={24} />
                </span>
              )}
              <input
                id="profile-avatar"
                ref={file}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => void upload(e.target.files?.[0])}
                disabled={save.isPending || reading}
                className="sr-only"
              />
              <Button
                type="button"
                disabled={save.isPending || reading}
                onClick={() => file.current?.click()}
              >
                {reading ? "Lendo…" : "Alterar avatar"}
              </Button>
              <button
                type="button"
                disabled={!draft.avatar || save.isPending}
                onClick={() => {
                  setDraft((previous) => ({ ...previous, avatar: null }));
                  setSaved(false);
                  setImageError("");
                }}
              >
                Remover avatar
              </button>
            </div>
            <p>
              PNG, JPEG ou WebP · até 512 KB. Salve o perfil para confirmar.
            </p>
            {(imageError || errors.avatar) && (
              <p role="alert" className="field-error">
                {imageError || errors.avatar}
              </p>
            )}
          </div>
        </div>
        {serverError && (
          <div role="alert" className="account-feedback error">
            <p>{serverError}</p>
            {isAxiosError(save.error) &&
              save.error.response?.data.code === "PROFILE_CHANGED" && (
                <button type="button" onClick={reload}>
                  Recarregar dados
                </button>
              )}
          </div>
        )}
        {saved && (
          <p role="status" className="account-feedback">
            Perfil atualizado.
          </p>
        )}
        <Button type="submit" disabled={save.isPending || reading}>
          {save.isPending ? "Salvando…" : "Salvar perfil"}
        </Button>
      </form>
      <PasswordForm userId={profile.id} />
    </>
  );
}
function PasswordForm({ userId }: { userId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const save = useMutation({
    mutationFn: (input: PasswordInput) => updatePassword(userId, input),
    gcTime: 0,
  });
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const data = new FormData(event.currentTarget);
    const input = {
      currentPassword: String(data.get("currentPassword") ?? ""),
      newPassword: String(data.get("newPassword") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    };
    const fields = validatePassword(input);
    setErrors(fields);
    setSuccess(false);
    save.reset();
    if (Object.keys(fields).length) {
      focusError(form.current, fields);
      return;
    }
    try {
      await save.mutateAsync(input);
      form.current?.reset();
      setSuccess(true);
      save.reset();
    } catch (error) {
      if (isAxiosError<AccountError>(error) && error.response?.data.fields) {
        setErrors(error.response.data.fields);
        focusError(form.current, error.response.data.fields);
      }
    }
  }
  return (
    <form
      ref={form}
      className="password-form"
      aria-label="Alterar senha"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <h2>Alterar senha</h2>
      <Field
        label="Senha atual"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        maxLength={128}
        error={errors.currentPassword}
        disabled={save.isPending}
      />
      <Field
        label="Nova senha"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        error={errors.newPassword}
        disabled={save.isPending}
      />
      <p className="account-hint">De 8 a 128 caracteres, com letra e número.</p>
      <Field
        label="Confirmar nova senha"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        error={errors.confirmPassword}
        disabled={save.isPending}
      />
      {save.isError && (
        <p role="alert" className="account-feedback error">
          {isAxiosError<AccountError>(save.error)
            ? (save.error.response?.data.message ??
              "Não foi possível alterar a senha.")
            : "Não foi possível alterar a senha."}
        </p>
      )}
      {success && (
        <p role="status" className="account-feedback">
          Senha alterada. Use a nova senha no próximo login.
        </p>
      )}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Salvando…" : "Salvar senha"}
      </Button>
    </form>
  );
}
