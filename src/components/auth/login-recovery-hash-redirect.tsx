"use client";

import { useEffect } from "react";

import { AUTH_SETUP_PASSWORD_PATH } from "@/lib/auth/auth-redirect";

/**
 * Safety net for Auth emails that still land on /login with implicit tokens in the hash.
 */
export function LoginRecoveryHashRedirect() {
  useEffect(() => {
    const hash = window.location.hash || "";
    if (!hash) return;
    if (
      /access_token|refresh_token|type=recovery|type=invite|type=signup/.test(hash)
    ) {
      window.location.replace(`${AUTH_SETUP_PASSWORD_PATH}${hash}`);
    }
  }, []);
  return null;
}
