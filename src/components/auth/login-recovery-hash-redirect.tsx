"use client";

import { useEffect } from "react";

import { hashLooksLikeAuthCallback } from "@/lib/auth/auth-callback";
import { AUTH_CALLBACK_PATH } from "@/lib/auth/auth-redirect";

/**
 * Safety net for Auth emails that still land on /login with implicit tokens in the hash.
 * Forward to /auth/callback so SSR cookies can be written before setup-password.
 */
export function LoginRecoveryHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash || "";
    if (!hashLooksLikeAuthCallback(hash)) return;
    window.location.replace(`${AUTH_CALLBACK_PATH}${hash}`);
  }, []);
  return null;
}
