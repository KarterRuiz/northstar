"use client";

import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { NorthStarAuthShell } from "@/components/auth/northstar-auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AUTH_FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
  setupPasswordCopy,
} from "@/lib/auth/auth-redirect";
import {
  completePasswordSetupAction,
  type SetupPasswordState,
} from "@/lib/auth/setup-password-actions";
import { NORTHSTAR_MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Props = {
  initialHasSession: boolean;
  intent: string | null;
  linkError: boolean;
};

const AUTH_HASH_RE =
  /access_token|refresh_token|type=recovery|type=invite|type=signup/;

function subscribeNoop() {
  return () => {};
}

export function SetupPasswordClient({ initialHasSession, intent, linkError }: Props) {
  const router = useRouter();
  const copy = setupPasswordCopy(intent);
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const hash = useSyncExternalStore(
    subscribeNoop,
    () => window.location.hash,
    () => "",
  );
  const hasAuthHash = AUTH_HASH_RE.test(hash);
  const [hashUser, setHashUser] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState<
    SetupPasswordState | undefined,
    FormData
  >(completePasswordSetupAction, undefined);

  useEffect(() => {
    if (initialHasSession || linkError || !hasAuthHash) return;

    let cancelled = false;
    void (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        await supabase.auth.getSession();
        const { data } = await supabase.auth.getUser();
        if (!cancelled) setHashUser(Boolean(data.user));
      } catch {
        if (!cancelled) setHashUser(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialHasSession, linkError, hasAuthHash]);

  useEffect(() => {
    if (!state?.ok) return;
    const timer = window.setTimeout(() => {
      router.replace(state.next);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [state, router]);

  const sessionReady = (initialHasSession && !linkError) || hashUser === true;
  const checkingHash =
    !linkError &&
    !sessionReady &&
    (!mounted || (hasAuthHash && hashUser === null));

  if (checkingHash) {
    return (
      <NorthStarAuthShell title="Opening your account…" description="Just a moment.">
        <p className="text-muted-foreground text-sm">Finishing sign-in…</p>
      </NorthStarAuthShell>
    );
  }

  if (state?.ok) {
    return (
      <NorthStarAuthShell title="Your account is ready." description="Continuing to NorthStar…">
        <p className="text-muted-foreground text-sm">Taking you to your workspace.</p>
      </NorthStarAuthShell>
    );
  }

  if (!sessionReady || linkError) {
    return (
      <NorthStarAuthShell
        title="This setup link is no longer valid."
        description="Request a new link to finish setting up your account."
        footer={
          <Link href={LOGIN_PATH} className="hover:text-foreground underline-offset-4 hover:underline">
            Return to Sign In
          </Link>
        }
      >
        <Button asChild className="w-full">
          <Link href={AUTH_FORGOT_PASSWORD_PATH}>Request a new setup link</Link>
        </Button>
      </NorthStarAuthShell>
    );
  }

  return (
    <NorthStarAuthShell
      title={copy.title}
      description={copy.subtitle}
      footer={
        <Link href={LOGIN_PATH} className="hover:text-foreground underline-offset-4 hover:underline">
          Return to Sign In
        </Link>
      }
    >
      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium leading-none">
            New password
          </label>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={NORTHSTAR_MIN_PASSWORD_LENGTH}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium leading-none">
            Confirm password
          </label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={NORTHSTAR_MIN_PASSWORD_LENGTH}
            disabled={pending}
          />
        </div>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(e) => setShowPassword(e.target.checked)}
            className="border-input size-4 rounded"
          />
          Show password
        </label>
        <p className="text-muted-foreground text-xs">
          At least {NORTHSTAR_MIN_PASSWORD_LENGTH} characters.
        </p>
        {state && !state.ok ? (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Create Password & Continue"}
        </Button>
      </form>
    </NorthStarAuthShell>
  );
}
