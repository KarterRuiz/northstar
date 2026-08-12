import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupPasswordClient } from "@/app/auth/setup-password/setup-password-client";
import {
  AUTH_CALLBACK_PATH,
  AUTH_SETUP_PASSWORD_PATH,
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
  if (params.code) {
    const callback = new URLSearchParams({
      code: params.code,
      next: AUTH_SETUP_PASSWORD_PATH,
    });
    if (params.type) callback.set("type", params.type);
    redirect(`${AUTH_CALLBACK_PATH}?${callback.toString()}`);
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
