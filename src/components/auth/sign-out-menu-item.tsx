"use client";

import { useTransition } from "react";

import { signOut } from "@/lib/auth/actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutMenuItem() {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      disabled={pending}
      onSelect={(event) => {
        event.preventDefault();
        startTransition(() => {
          void signOut();
        });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </DropdownMenuItem>
  );
}
