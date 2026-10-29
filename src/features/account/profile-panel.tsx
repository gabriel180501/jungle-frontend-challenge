import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useAuth } from "../auth/context";
import { profileOptions } from "./api";
import { ProfileForm } from "./profile-form";
import { Button } from "../../components/ui/button";
export function ProfilePanel() {
  const userId = useAuth().user?.id;
  const search = useSearch({ strict: false }) as {
    accountScenario?: "slow" | "default";
  };
  const query = useQuery(profileOptions(userId, search.accountScenario));
  const [reset, setReset] = useState(0);
  if (!userId) return null;
  if (query.isPending)
    return (
      <div
        className="skeleton account-skeleton"
        role="status"
        aria-label="Carregando dados da conta"
      />
    );
  if (query.isError)
    return (
      <div role="alert">
        <p>Não foi possível carregar o perfil.</p>
        <Button onClick={() => void query.refetch()}>Tentar novamente</Button>
      </div>
    );
  return (
    <>
      <p className="account-email">{query.data.email}</p>
      <ProfileForm
        key={`${userId}:${reset}`}
        profile={query.data}
        reload={() => {
          void query.refetch().then(() => setReset((value) => value + 1));
        }}
      />
    </>
  );
}
