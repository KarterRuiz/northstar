import Link from "next/link";

import { signInWithPassword, type SignInState } from "@/lib/auth/actions";
import { loadStaffInviteLoginHint } from "@/features/admin/staff-directory/load-staff-invite-login-hint";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/config/site";

import { LoginForm } from "./login-form";

const initialSignInState: SignInState = { error: null };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; staff_invite?: string }>;
}) {
  const params = await searchParams;
  const profileError = params.error === "profile";
  const inviteHint = await loadStaffInviteLoginHint(params.staff_invite);

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center p-4">
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
              <p className="text-foreground font-medium">You have a pending invitation</p>
              <p className="mt-1">
                Sign in with <span className="text-foreground font-medium">{inviteHint.emailHint}</span>{" "}
                ({inviteHint.fullName}) using the password for that account.
              </p>
            </div>
          ) : null}
          {profileError ? (
            <p className="text-destructive text-sm">
              Your account has no valid role in{" "}
              <code className="text-xs">profiles.role</code>. Ask an admin to
              assign one of: admin, teacher, registrar, principal, or
              vice_principal.
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
