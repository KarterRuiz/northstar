import Link from "next/link";
import { redirect } from "next/navigation";

import { signInWithPassword, type SignInState } from "@/lib/auth/actions";
import { loadStaffInviteLoginHint } from "@/features/admin/staff-directory/load-staff-invite-login-hint";
import { LoginRecoveryHashRedirect } from "@/components/auth/login-recovery-hash-redirect";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { buildAuthEmailCallbackHandoffPath } from "@/lib/auth/auth-redirect";

import { LoginForm } from "./login-form";

const initialSignInState: SignInState = { error: null };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    staff_invite?: string;
    code?: string;
    type?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;
  const handoff = buildAuthEmailCallbackHandoffPath(params);
  if (handoff) {
    redirect(handoff);
  }
  const profileError = params.error === "profile";
  const deactivatedError = params.error === "deactivated";
  const inviteHint = await loadStaffInviteLoginHint(params.staff_invite);

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center p-4">
      <LoginRecoveryHashRedirect />
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Sign in to {siteConfig.name}</CardTitle>
          <CardDescription>
            {siteConfig.name} · {siteConfig.tagline}. Sign in with your email and password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {inviteHint.ok ? (
            <div
              className="bg-muted/50 text-muted-foreground rounded-lg border px-3 py-2 text-sm"
              role="status"
            >
              <p className="text-foreground font-medium">
                Welcome, {inviteHint.fullName}
              </p>
              <p className="mt-1">
                Confirm you are signing in as{" "}
                <span className="text-foreground font-medium">{inviteHint.emailHint}</span>.
                Open the NorthStar email we sent to create your password — you will not need a
                temporary password. Your role and class access were already assigned by your
                school.
              </p>
            </div>
          ) : null}
          {deactivatedError ? (
            <p className="text-destructive text-sm">
              This account has been deactivated. Contact your school administrator if you need
              access restored.
            </p>
          ) : null}
          {profileError ? (
            <p className="text-destructive text-sm">
              Your account does not have a valid school role yet. Ask an administrator
              to assign one (admin, teacher, registrar, principal, or vice principal).
            </p>
          ) : null}
          <LoginForm action={signInWithPassword} initialState={initialSignInState} />
        </CardContent>
        <CardFooter className="text-muted-foreground justify-center text-xs">
          <Link href="/" className="hover:text-foreground underline-offset-4 hover:underline">
            Back to home
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
