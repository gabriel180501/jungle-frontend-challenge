import { redirect } from "@tanstack/react-router";
import { queryClient } from "../../app/query-client";
import { getSessionReason, sessionOptions } from "./service";
import { safeReturnTo } from "./search";
export async function requireSession({
  location,
}: {
  location: { href: string };
}) {
  const session = await queryClient.fetchQuery({
    ...sessionOptions(),
    staleTime: 0,
  });
  if (!session.user)
    throw redirect({
      to: "/login",
      search: {
        redirect: safeReturnTo(location.href),
        reason: getSessionReason(),
      },
    });
  return { user: session.user };
}
