import Link from "next/link";

import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          This page is not available
        </h1>
        <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
          The route may not exist, or the URL might be mistyped. Return to the{" "}
          {siteConfig.name} home page or sign in to continue.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
