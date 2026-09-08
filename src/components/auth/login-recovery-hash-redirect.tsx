"use client";

import { useEffect } from "react";

import { hashLooksLikeAuthCallback } from "@/lib/auth/auth-callback";
import { AUTH_CALLBACK_PATH } from "@/lib/auth/auth-redirect";

/**
 * Safety net for Auth emails (invite + recovery) that land on `/` or `/login`
 * with implicit tokens in the hash. Forward to /auth/callback so SSR cookies
 * can be written before setup-password — never leave the user on the public homepage.
 */
export function LoginRecoveryHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash || "";
    if (!hashLooksLikeAuthCallback(hash)) return;
    window.location.replace(`${AUTH_CALLBACK_PATH}${hash}`);
  }, []);
  return null;
}
