import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTH_CALLBACK_PATH,
  AUTH_SETUP_PASSWORD_PATH,
  LOGIN_PATH,
  buildAuthEmailCallbackHandoffPath,
  isAuthCallbackPath,
  isSafeInternalPath,
  mapAuthCallbackDestination,
  sanitizeAuthNextPath,
  setupPasswordCopy,
  setupPasswordShouldRenderForm,
} from "@/lib/auth/auth-redirect";

describe("sanitizeAuthNextPath", () => {
  it("defaults to setup-password", () => {
    assert.equal(sanitizeAuthNextPath(null), AUTH_SETUP_PASSWORD_PATH);
    assert.equal(sanitizeAuthNextPath(""), AUTH_SETUP_PASSWORD_PATH);
  });

  it("allows setup-password, login, and dashboard paths", () => {
    assert.equal(
      sanitizeAuthNextPath("/auth/setup-password"),
      AUTH_SETUP_PASSWORD_PATH,
    );
    assert.equal(sanitizeAuthNextPath("/login"), LOGIN_PATH);
    assert.equal(
      sanitizeAuthNextPath("/dashboard/teacher"),
      "/dashboard/teacher",
    );
    assert.equal(
      sanitizeAuthNextPath("/dashboard/vice_principal/calendar"),
      "/dashboard/vice_principal/calendar",
    );
  });

  it("rejects open redirects", () => {
    assert.equal(
      sanitizeAuthNextPath("https://evil.example/phish"),
      AUTH_SETUP_PASSWORD_PATH,
    );
    assert.equal(
      sanitizeAuthNextPath("//evil.example"),
      AUTH_SETUP_PASSWORD_PATH,
    );
    assert.equal(
      sanitizeAuthNextPath("/\\evil.example"),
      AUTH_SETUP_PASSWORD_PATH,
    );
    assert.equal(
      sanitizeAuthNextPath("/auth/setup-password@evil.example"),
      AUTH_SETUP_PASSWORD_PATH,
    );
  });

  it("isSafeInternalPath rejects protocol-relative URLs", () => {
    assert.equal(isSafeInternalPath("//example.com"), false);
    assert.equal(isSafeInternalPath("/login"), true);
  });
});

describe("buildAuthEmailCallbackHandoffPath", () => {
  it("A: invite PKCE landing on public / forwards to callback → setup-password", () => {
    const path = buildAuthEmailCallbackHandoffPath({
      code: "invite-pkce-code",
      type: "invite",
    });
    assert.equal(
      path,
      `${AUTH_CALLBACK_PATH}?code=invite-pkce-code&next=${encodeURIComponent(AUTH_SETUP_PASSWORD_PATH)}&type=invite`,
    );
    assert.doesNotMatch(path ?? "", /^\/(\?|$)/);
    assert.doesNotMatch(path ?? "", /\/login/);
  });

  it("B: recovery PKCE uses the same callback handoff (never public /)", () => {
    const invite = buildAuthEmailCallbackHandoffPath({
      code: "same-shape",
      type: "invite",
    });
    const recovery = buildAuthEmailCallbackHandoffPath({
      code: "same-shape",
      type: "recovery",
    });
    assert.ok(invite?.startsWith(AUTH_CALLBACK_PATH));
    assert.ok(recovery?.startsWith(AUTH_CALLBACK_PATH));
    assert.notEqual(invite, "/");
    assert.notEqual(recovery, "/");
  });

  it("returns null when there is no auth code (plain homepage stays public)", () => {
    assert.equal(buildAuthEmailCallbackHandoffPath({}), null);
    assert.equal(buildAuthEmailCallbackHandoffPath({ type: "invite" }), null);
  });
});

describe("mapAuthCallbackDestination", () => {
  it("A/B/C/D: invite and recovery go to setup-password, never login", () => {
    assert.deepEqual(
      mapAuthCallbackDestination({
        type: "invite",
        next: "/auth/setup-password",
        exchangeOk: true,
      }),
      {
        kind: "setup_password",
        path: `${AUTH_SETUP_PASSWORD_PATH}?intent=setup`,
        intent: "setup",
      },
    );
    assert.deepEqual(
      mapAuthCallbackDestination({
        type: "recovery",
        next: "/auth/setup-password",
        exchangeOk: true,
      }),
      {
        kind: "setup_password",
        path: `${AUTH_SETUP_PASSWORD_PATH}?intent=recovery`,
        intent: "recovery",
      },
    );
    assert.equal(
      mapAuthCallbackDestination({
        type: "recovery",
        next: "/login",
        exchangeOk: true,
      }).kind,
      "setup_password",
    );
  });

  it("E: failed exchange → expired setup page, not login", () => {
    assert.deepEqual(
      mapAuthCallbackDestination({
        type: "recovery",
        next: "/login",
        exchangeOk: false,
      }),
      {
        kind: "invalid",
        path: `${AUTH_SETUP_PASSWORD_PATH}?error=invalid`,
      },
    );
  });

  it("K: explicit dashboard next + role href → workspace", () => {
    assert.deepEqual(
      mapAuthCallbackDestination({
        type: null,
        next: "/dashboard/teacher",
        exchangeOk: true,
        roleHref: "/dashboard/teacher",
      }),
      { kind: "workspace", path: "/dashboard/teacher" },
    );
    assert.deepEqual(
      mapAuthCallbackDestination({
        type: null,
        next: "/dashboard/admin",
        exchangeOk: true,
      }),
      { kind: "workspace", path: "/dashboard/admin" },
    );
  });

  it("does not trust an external next even when exchange succeeds", () => {
    const dest = mapAuthCallbackDestination({
      type: null,
      next: "https://evil.example",
      exchangeOk: true,
    });
    assert.equal(dest.kind, "setup_password");
  });

  it("B: invite never dumps to public homepage /", () => {
    const dest = mapAuthCallbackDestination({
      type: "invite",
      next: "/",
      exchangeOk: true,
    });
    assert.equal(dest.kind, "setup_password");
    assert.equal(dest.path.startsWith(AUTH_SETUP_PASSWORD_PATH), true);
    assert.notEqual(dest.path, "/");
  });

  it("E: recovery still goes to setup-password after forgot-password", () => {
    const dest = mapAuthCallbackDestination({
      type: "recovery",
      next: AUTH_SETUP_PASSWORD_PATH,
      exchangeOk: true,
    });
    assert.equal(dest.path, `${AUTH_SETUP_PASSWORD_PATH}?intent=recovery`);
  });

  it("F: failed invite exchange fails safely on setup-password, not /", () => {
    const dest = mapAuthCallbackDestination({
      type: "invite",
      next: AUTH_SETUP_PASSWORD_PATH,
      exchangeOk: false,
    });
    assert.equal(dest.kind, "invalid");
    assert.equal(dest.path, `${AUTH_SETUP_PASSWORD_PATH}?error=invalid`);
  });
});

describe("setupPasswordShouldRenderForm", () => {
  it("does not require ns_password_setup — getUser() is enough", () => {
    assert.equal(
      setupPasswordShouldRenderForm({ authenticated: true, linkError: false }),
      true,
    );
  });

  it("H: invalid link still points users at setup-password, not login", () => {
    assert.equal(isAuthCallbackPath(AUTH_CALLBACK_PATH), true);
    assert.equal(
      mapAuthCallbackDestination({
        type: "recovery",
        next: LOGIN_PATH,
        exchangeOk: false,
      }).path.startsWith(AUTH_SETUP_PASSWORD_PATH),
      true,
    );
  });
});

describe("setupPasswordCopy", () => {
  it("uses first-time vs recovery wording, with a generic fallback", () => {
    assert.match(setupPasswordCopy("setup").title, /Finish setting up/i);
    assert.match(setupPasswordCopy("recovery").title, /Create a new password/i);
    assert.equal(setupPasswordCopy(null).title, "Set your NorthStar password");
  });
});
