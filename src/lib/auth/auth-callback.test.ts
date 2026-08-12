import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accumulateAuthCookies,
  hashLooksLikeAuthCallback,
  isHttpsRequest,
  parseImplicitAuthHash,
  sanitizeAuthCookieWriteOptions,
} from "@/lib/auth/auth-callback";
import {
  AUTH_CALLBACK_PATH,
  AUTH_SETUP_PASSWORD_PATH,
  isAuthCallbackPath,
  setupPasswordShouldRenderForm,
} from "@/lib/auth/auth-redirect";

describe("isAuthCallbackPath", () => {
  it("matches /auth/callback only", () => {
    assert.equal(isAuthCallbackPath(AUTH_CALLBACK_PATH), true);
    assert.equal(isAuthCallbackPath("/auth/callback/"), true);
    assert.equal(isAuthCallbackPath("/auth/setup-password"), false);
    assert.equal(isAuthCallbackPath("/login"), false);
  });
});

describe("setupPasswordShouldRenderForm", () => {
  it("D: authenticated user always sees the password form", () => {
    assert.equal(
      setupPasswordShouldRenderForm({ authenticated: true, linkError: false }),
      true,
    );
    assert.equal(
      setupPasswordShouldRenderForm({ authenticated: true, linkError: true }),
      true,
    );
  });

  it("G: no user + invalid/expired link → invalid state, not the form", () => {
    assert.equal(
      setupPasswordShouldRenderForm({ authenticated: false, linkError: true }),
      false,
    );
    assert.equal(
      setupPasswordShouldRenderForm({ authenticated: false, linkError: false }),
      false,
    );
  });
});

describe("parseImplicitAuthHash", () => {
  it("reads access + refresh tokens from a recovery hash", () => {
    const parsed = parseImplicitAuthHash(
      "#access_token=aaa.bbb.ccc&refresh_token=rt_1&type=recovery&expires_in=3600",
    );
    assert.deepEqual(parsed, {
      accessToken: "aaa.bbb.ccc",
      refreshToken: "rt_1",
      type: "recovery",
    });
  });

  it("returns null when tokens are missing", () => {
    assert.equal(parseImplicitAuthHash(""), null);
    assert.equal(parseImplicitAuthHash("#type=recovery"), null);
    assert.equal(parseImplicitAuthHash("#access_token=only"), null);
  });

  it("detects auth-looking hashes without parsing tokens", () => {
    assert.equal(hashLooksLikeAuthCallback("#type=invite"), true);
    assert.equal(hashLooksLikeAuthCallback("#foo=bar"), false);
  });
});

describe("auth cookie write options", () => {
  it("C: drops non-serializable fields and forces Secure on HTTPS", () => {
    const options = sanitizeAuthCookieWriteOptions(
      {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        maxAge: 3600,
        encode: () => "nope",
        name: "leaked",
      },
      true,
    );
    assert.equal(options.secure, true);
    assert.equal(options.path, "/");
    assert.equal(options.sameSite, "lax");
    assert.equal(options.httpOnly, false);
    assert.equal(options.maxAge, 3600);
    assert.equal("encode" in options, false);
    assert.equal("name" in options, false);
  });

  it("J: localhost HTTP keeps Secure=false", () => {
    const options = sanitizeAuthCookieWriteOptions({ sameSite: "lax" }, false);
    assert.equal(options.secure, false);
    assert.equal(isHttpsRequest({ protocol: "http:", forwardedProto: null }), false);
    assert.equal(isHttpsRequest({ protocol: "https:", forwardedProto: null }), true);
    assert.equal(isHttpsRequest({ protocol: "http:", forwardedProto: "https" }), true);
  });

  it("accumulates chunked auth cookies in write order", () => {
    const pending = accumulateAuthCookies(
      [],
      [
        { name: "sb-auth-token.0", value: "chunk-a", options: { path: "/", maxAge: 0 } },
        { name: "sb-auth-token.0", value: "chunk-b", options: { path: "/", maxAge: 100 } },
      ],
      true,
    );
    assert.equal(pending.length, 2);
    assert.equal(pending[0]?.value, "chunk-a");
    assert.equal(pending[1]?.value, "chunk-b");
    assert.equal(pending[1]?.options?.secure, true);
    assert.equal(pending[1]?.options?.path, "/");
  });
});

describe("setup-password destination still never dumps to Sign In", () => {
  it("A: recovery/invite next stays on setup-password", () => {
    assert.equal(AUTH_SETUP_PASSWORD_PATH, "/auth/setup-password");
    assert.equal(AUTH_CALLBACK_PATH, "/auth/callback");
  });
});
