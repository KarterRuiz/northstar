"use client";

import { useActionState } from "react";
import Link from "next/link";

import { NorthStarAuthShell } from "@/components/auth/northstar-auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOGIN_PATH } from "@/lib/auth/auth-redirect";
import {
  requestPasswordSetupLinkAction,
  type ForgotPasswordState,
} from "@/lib/auth/forgot-password-actions";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ForgotPasswordState | undefined,
    FormData
  >(requestPasswordSetupLinkAction, undefined);

  return (
    <NorthStarAuthShell
      title="Set your NorthStar password"
      description="Enter the email for your NorthStar account. We’ll send a setup link — you won’t need your current password."
      footer={
        <Link href={LOGIN_PATH} className="hover:text-foreground underline-offset-4 hover:underline">
          Return to Sign In
        </Link>
      }
    >
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
        {state?.message ? (
          <p
            className={state.ok ? "text-foreground text-sm" : "text-destructive text-sm"}
            role={state.ok ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Sending…" : "Send setup link"}
        </Button>
      </form>
    </NorthStarAuthShell>
  );
}
