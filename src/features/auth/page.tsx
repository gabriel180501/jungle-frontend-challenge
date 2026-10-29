import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff, X } from "lucide-react";
import { isAxiosError } from "axios";
import { submitAuth } from "./service";
import type { AuthError, AuthFields, AuthInput } from "./contracts";
import { validateAuth } from "./validation";
import { safeReturnTo } from "./search";
import { useAuth } from "./context";
import { Button } from "../../components/ui/button";
import { catalogOptions } from "../catalog/api";
import { defaultSearch } from "../catalog/search";
import { collectionOptions } from "../catalog/contracts";
import { formatEth } from "../../lib/eth";
export function LoginPage() {
  return <AuthPage register={false} />;
}
export function RegisterPage() {
  return <AuthPage register />;
}
function AuthPage({ register }: { register: boolean }) {
  const search = useSearch({ strict: false }) as {
    redirect?: string;
    reason?: string;
  };
  const redirect = safeReturnTo(search.redirect);
  const navigate = useNavigate();
  const auth = useAuth();
  const [fields, setFields] = useState<AuthFields>({});
  const [showPassword, setShowPassword] = useState(false);
  const notice = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const mutation = useMutation({
    mutationFn: (input: AuthInput) => submitAuth(register, input),
  });
  function focusField(errors: AuthFields) {
    const first = Object.keys(errors)[0];
    (form.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending || submitting.current) return;
    const values = new FormData(event.currentTarget);
    const input: AuthInput = {
      username: String(values.get("username") ?? ""),
      email: String(values.get("email") ?? ""),
      password: String(values.get("password") ?? ""),
      confirmPassword: String(values.get("confirmPassword") ?? ""),
    };
    const errors = validateAuth(input, register);
    setFields(errors);
    mutation.reset();
    if (Object.keys(errors).length) {
      focusField(errors);
      return;
    }
    submitting.current = true;
    try {
      await mutation.mutateAsync(input);
      await navigate({ href: redirect, replace: true });
    } catch (error) {
      if (isAxiosError<AuthError>(error) && error.response?.data.fields) {
        setFields(error.response.data.fields);
        focusField(error.response.data.fields);
      }
    } finally {
      submitting.current = false;
    }
  }
  const serverMessage = isAxiosError<AuthError>(mutation.error)
    ? (mutation.error.response?.data.message ??
      "Não foi possível conectar. Tente novamente.")
    : mutation.isError
      ? "Não foi possível concluir. Tente novamente."
      : "";
  const inputField = (
    name: keyof AuthInput,
    label: string,
    type: string,
    autoComplete: string,
  ) => (
    <div className="auth-field">
      <label htmlFor={`auth-${name}`}>{label}</label>
      <div className={type === "password" ? "auth-password" : undefined}>
        <input
          id={`auth-${name}`}
          name={name}
          type={type === "password" && showPassword ? "text" : type}
          autoComplete={autoComplete}
          maxLength={
            name === "password" || name === "confirmPassword"
              ? 128
              : name === "email"
                ? 254
                : 24
          }
          aria-invalid={!!fields[name]}
          aria-describedby={fields[name] ? `${name}-error` : undefined}
          disabled={mutation.isPending}
        />
        {type === "password" && name === "password" && (
          <button
            type="button"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {fields[name] && (
        <p className="field-error" id={`${name}-error`}>
          {fields[name]}
        </p>
      )}
    </div>
  );
  return (
    <div className="auth-page">
      <AuthBackdrop />
      <section className="auth-card" aria-labelledby="auth-title">
        <Link to="/" search={defaultSearch} className="auth-wordmark">
          KURIO
        </Link>
        <Link
          to="/"
          search={defaultSearch}
          className="auth-close"
          aria-label="Voltar ao catálogo"
        >
          <X size={18} />
        </Link>
        <div className="auth-route-tabs">
          <Link
            to="/login"
            search={{ redirect, reason: "" }}
            activeProps={{ className: "selected" }}
          >
            Entrar
          </Link>
          <Link
            to="/register"
            search={{ redirect, reason: "" }}
            activeProps={{ className: "selected" }}
          >
            Criar conta
          </Link>
        </div>
        <h1 id="auth-title">
          {register ? "Criar perfil de colecionador" : "Entrar"}
        </h1>
        <p className="auth-description">
          {register
            ? "Crie seu perfil e descubra novas coleções."
            : "Acesse sua conta para continuar sua coleção."}
        </p>
        {(search.reason === "expired" || auth.expired) && (
          <p className="auth-expired" role="alert">
            Sua sessão expirou. Entre novamente para continuar de onde parou.
          </p>
        )}
        <form
          ref={form}
          onSubmit={(event) => void submit(event)}
          noValidate
          aria-busy={mutation.isPending}
        >
          {register &&
            inputField("username", "Nome de usuário", "text", "username")}
          {inputField("email", "E-mail", "email", "email")}
          {inputField(
            "password",
            "Senha",
            "password",
            register ? "new-password" : "current-password",
          )}
          {register && (
            <p className="auth-password-hint">
              Use pelo menos 8 caracteres, com letra e número.
            </p>
          )}
          {register &&
            inputField(
              "confirmPassword",
              "Confirmar senha",
              "password",
              "new-password",
            )}
          {!register && (
            <button
              className="forgot-password"
              type="button"
              onClick={() => notice.current?.showModal()}
            >
              Esqueceu a senha?
            </button>
          )}
          {serverMessage && (
            <p className="auth-error" role="alert">
              {serverMessage}
            </p>
          )}
          <Button
            type="submit"
            className="auth-submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? register
                ? "Criando conta…"
                : "Entrando…"
              : register
                ? "Criar perfil"
                : "Entrar"}
          </Button>
        </form>
        <div className="auth-social">
          <span>Ou continue com</span>
          <Button variant="outline" disabled>
            Continuar com Google
          </Button>
          <Button variant="outline" disabled>
            Continuar com Facebook
          </Button>
          <p>Login social indisponível nesta demonstração.</p>
        </div>
        <p className="auth-switch">
          {register ? "Já tem uma conta? " : "Novo na Kurio? "}
          <Link
            to={register ? "/login" : "/register"}
            search={{ redirect, reason: "" }}
          >
            {register ? "Entre" : "Crie uma conta"}
          </Link>
        </p>
      </section>
      <dialog
        className="notice-dialog"
        ref={notice}
        aria-labelledby="recovery-title"
      >
        <h2 id="recovery-title">Recuperação de senha</h2>
        <p>
          A recuperação por e-mail ainda não está disponível nesta demonstração.
        </p>
        <form method="dialog">
          <Button>Entendi</Button>
        </form>
      </dialog>
    </div>
  );
}
function AuthBackdrop() {
  const query = useQuery(catalogOptions(defaultSearch));
  return (
    <div className="auth-backdrop page-width" aria-hidden="true" inert>
      <div className="auth-backdrop-hero">
        <div>
          <p>Bem-vindo à Kurio</p>
          <h2>
            SEJA DONO DO FUTURO
            <br />
            DA ARTE DIGITAL
          </h2>
          <p>
            Descubra NFTs selecionados de criadores do mundo todo e colecione
            arte digital.
          </p>
          <span>EXPLORAR</span>
        </div>
        <img src="/images/emerald-ape.webp" width="640" height="640" alt="" />
      </div>
      <div className="auth-backdrop-catalog">
        <aside>
          <h3>Coleções</h3>
          {collectionOptions.map(([id, label]) => (
            <p key={id}>{label}</p>
          ))}
        </aside>
        <div>
          <p>Todos os NFTs · Novos lançamentos · Em alta</p>
          <div>
            {query.data?.items.map((nft) => (
              <article key={nft.id}>
                <img src={nft.image} width="640" height="640" alt="" />
                <h3>{nft.name}</h3>
                <p>{formatEth(nft.price)} ETH</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
