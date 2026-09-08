import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupPasswordClient } from "@/app/auth/setup-password/setup-password-client";
import {
  buildAuthEmailCallbackHandoffPath,
  setupPasswordShouldRenderForm,
} from "@/lib/auth/auth-redirect";
import { getUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set your password",
};

export default async function SetupPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; error?: string; code?: string; type?: string }>;
}) {
  const params = await searchParams;
  const handoff = buildAuthEmailCallbackHandoffPath(params);
  if (handoff) {
    redirect(handoff);
  }

  const user = await getUser();
  const authenticated = Boolean(user);
  const linkError = params.error === "invalid";

  console.info("[auth/setup-password]", {
    authenticatedUser: authenticated,
    linkError,
  });

  return (
    <SetupPasswordClient
      initialHasSession={setupPasswordShouldRenderForm({
        authenticated,
        linkError,
      })}
      intent={params.intent ?? null}
      linkError={linkError && !authenticated}
    />
  );
}
