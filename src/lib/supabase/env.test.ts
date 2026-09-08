import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  getAuthEmailRedirectToLogin,
  getAuthEmailRedirectToSetupPassword,
  getCanonicalSiteUrl,
  resolveStaffAuthUrls,
} from "@/lib/supabase/env";

describe("canonical auth email redirects", () => {
  const originalSite = process.env.NEXT_PUBLIC_SITE_URL;
  const originalPublicVercel = process.env.NEXT_PUBLIC_VERCEL_URL;
  const originalVercel = process.env.VERCEL_URL;
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSite;
    if (originalPublicVercel === undefined) delete process.env.NEXT_PUBLIC_VERCEL_URL;
    else process.env.NEXT_PUBLIC_VERCEL_URL = originalPublicVercel;
    if (originalVercel === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = originalVercel;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
  });

  it("H: production site URL is used for Auth email redirects (not localhost)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://northstar-roan.vercel.app";
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
    delete process.env.VERCEL_URL;

    assert.equal(getCanonicalSiteUrl(), "https://northstar-roan.vercel.app");
    assert.equal(
      getAuthEmailRedirectToSetupPassword(),
      "https://northstar-roan.vercel.app/auth/callback?next=%2Fauth%2Fsetup-password",
    );
    assert.equal(
      getAuthEmailRedirectToLogin(),
      "https://northstar-roan.vercel.app/login",
    );
    assert.doesNotMatch(getAuthEmailRedirectToSetupPassword(), /localhost/i);
  });

  it("I: local development can still resolve localhost", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_ENV;
    if (process.env.NODE_ENV === "production") {
      return; // skip when the test runner itself is production
    }
    assert.equal(getCanonicalSiteUrl(), "http://localhost:3000");
    assert.match(getAuthEmailRedirectToSetupPassword(), /localhost:3000/);
  });

  it("invite and setup share one canonical helper pair", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://northstar-roan.vercel.app";
    const urls = resolveStaffAuthUrls();
    assert.equal(urls.ok, true);
    if (!urls.ok) return;
    assert.equal(urls.redirectTo, getAuthEmailRedirectToSetupPassword());
    assert.equal(urls.inviteLinkBase, getAuthEmailRedirectToLogin());
    assert.match(urls.redirectTo, /\/auth\/callback/);
    assert.match(urls.redirectTo, /setup-password/);
  });

  it("I: individual + bulk invite redirectTo matches recovery (never / or localhost)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://northstar-roan.vercel.app";
    const inviteRedirect = getAuthEmailRedirectToSetupPassword();
    assert.equal(
      inviteRedirect,
      "https://northstar-roan.vercel.app/auth/callback?next=%2Fauth%2Fsetup-password",
    );
    assert.notEqual(new URL(inviteRedirect).pathname, "/");
    assert.doesNotMatch(inviteRedirect, /localhost/i);
  });
});
