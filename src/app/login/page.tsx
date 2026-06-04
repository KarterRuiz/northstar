import Link from "next/link";

import { signInWithPassword, type SignInState } from "@/lib/auth/actions";
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
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const profileError = params.error === "profile";

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Sign in to {siteConfig.name}</CardTitle>
          <CardDescription>
            {siteConfig.name} · {siteConfig.tagline}. Use your school account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
