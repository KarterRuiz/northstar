"use client";

import { useActionState } from "react";
import Link from "next/link";

import type { SignInState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_FORGOT_PASSWORD_PATH } from "@/lib/auth/auth-redirect";

type Props = {
  action: (state: SignInState, formData: FormData) => Promise<SignInState>;
  initialState: SignInState;
};

export function LoginForm({ action, initialState }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium leading-none">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium leading-none">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </div>
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm">
        <Link
          href={AUTH_FORGOT_PASSWORD_PATH}
          className="text-primary underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </p>
    </form>
  );
}
