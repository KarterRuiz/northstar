import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { siteConfig } from "@/config/site";
import { roleDashboardHref } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { getProfileRole, getUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getUser();
  if (user) {
    const role = await getProfileRole(user.id);
    if (role) {
      redirect(roleDashboardHref(role));
    }
  }

  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_circle_at_20%_-10%,color-mix(in_oklab,var(--color-primary)_22%,transparent),transparent_55%),radial-gradient(900px_circle_at_90%_20%,color-mix(in_oklab,var(--color-ring)_16%,transparent),transparent_55%)]"
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16 sm:px-10">
        <header className="space-y-5">
          <p className="text-primary text-sm font-semibold tracking-wide uppercase">
            {siteConfig.tagline}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {siteConfig.name}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {siteConfig.description}
          </p>
          <div className="pt-2">
            <Button asChild size="lg">
              <Link href="/login">
                Sign in
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </header>
      </main>
      <footer className="text-muted-foreground border-t px-6 py-6 text-center text-xs sm:px-10">
        {siteConfig.footerNote}
      </footer>
    </div>
  );
}
