import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canResendStaffMemberInvitation,
  canSendActiveStaffPasswordReset,
  canSendStaffNewInvitation,
  canSendStaffSetupLink,
  formatInviteSentHint,
  isAuthEmailRateLimitError,
  isAuthUserAlreadyRegisteredError,
  messageForStaffInviteEmailFailure,
  messageForStaffSetupLinkFailure,
  resolveStaffDirectoryAccessAction,
  resolveStaffInviteStatusInlineControls,
} from "@/lib/staff/staff-invite-email";
import {
  canSendStaffInvitation,
  resolveStaffRosterDisplayStatus,
  staffRosterStatusLabel,
} from "@/lib/staff/staff-roster-status";

describe("staff invite email helpers", () => {
  it("detects already-registered Auth errors", () => {
    assert.equal(
      isAuthUserAlreadyRegisteredError(
        "A user with this email address has already been registered",
      ),
      true,
    );
    assert.equal(isAuthUserAlreadyRegisteredError("email_exists"), true);
    assert.equal(
      isAuthUserAlreadyRegisteredError(
        "This email already has an activated account. Resend is only for pending invitations.",
      ),
      true,
    );
    assert.equal(isAuthUserAlreadyRegisteredError("rate limit exceeded"), false);
  });

  it("detects rate-limit Auth errors", () => {
    assert.equal(isAuthEmailRateLimitError("email rate limit exceeded"), true);
    assert.equal(isAuthEmailRateLimitError("over_email_send_rate_limit"), true);
    assert.equal(isAuthEmailRateLimitError("Too Many Requests"), true);
    assert.equal(isAuthEmailRateLimitError("invalid api key"), false);
  });

  it("surfaces a clear admin message for rate limits on resend", () => {
    const msg = messageForStaffInviteEmailFailure("email rate limit exceeded", {
      forResend: true,
    });
    assert.match(msg, /rate-limiting/i);
    assert.match(msg, /try again/i);
  });

  it("translates already-registered into setup-link guidance (no raw Supabase copy)", () => {
    const msg = messageForStaffInviteEmailFailure(
      "A user with this email address has already been registered",
      { forResend: true },
    );
    assert.match(msg, /already exists/i);
    assert.match(msg, /setup link/i);
    assert.doesNotMatch(msg, /activated account/i);
    assert.doesNotMatch(msg, /Resend is only for pending/i);
  });

  it("does not pretend resend succeeded on generic failure", () => {
    const msg = messageForStaffInviteEmailFailure("smtp failure", { forResend: true });
    assert.match(msg, /could not be resent/i);
    assert.doesNotMatch(msg, /Invitation saved/i);
  });

  it("formats setup-link failures without exposing raw provider errors", () => {
    const msg = messageForStaffSetupLinkFailure("smtp exploded with stack");
    assert.match(msg, /Setup link could not be sent/i);
    assert.doesNotMatch(msg, /smtp exploded/i);
  });

  it("formats sent-just-now from recent sent_at", () => {
    const now = Date.parse("2026-08-11T20:00:00.000Z");
    assert.equal(
      formatInviteSentHint("2026-08-11T19:59:30.000Z", now),
      "Sent just now",
    );
    assert.equal(formatInviteSentHint("2026-08-11T19:50:00.000Z", now), null);
    assert.equal(formatInviteSentHint(null, now), null);
  });
});

describe("staff directory access actions", () => {
  it("A/B: pending invitation → Resend invitation", () => {
    assert.equal(
      resolveStaffDirectoryAccessAction({
        profileId: null,
        displayStatus: "invitation_sent",
        email: "teacher@school.edu",
        authEmailConfirmed: false,
      }),
      "resend_invite",
    );
    assert.equal(
      canResendStaffMemberInvitation({
        profileId: null,
        displayStatus: "invitation_sent",
        email: "teacher@school.edu",
        authEmailConfirmed: false,
      }),
      true,
    );
  });

  it("C: confirmed Auth, unlinked → Send setup link (never Resend)", () => {
    assert.equal(
      resolveStaffDirectoryAccessAction({
        profileId: null,
        displayStatus: "invitation_sent",
        email: "teacher@school.edu",
        authEmailConfirmed: true,
      }),
      "send_setup_link",
    );
    assert.equal(
      canResendStaffMemberInvitation({
        profileId: null,
        displayStatus: "invitation_sent",
        email: "teacher@school.edu",
        authEmailConfirmed: true,
      }),
      false,
    );
    assert.equal(
      canSendStaffSetupLink({
        profileId: null,
        displayStatus: "account_exists",
        email: "teacher@school.edu",
        authEmailConfirmed: true,
      }),
      true,
    );
  });

  it("D: Active linked profile → no invite/setup action; optional password reset", () => {
    assert.equal(
      resolveStaffDirectoryAccessAction({
        profileId: "11111111-1111-1111-1111-111111111111",
        displayStatus: "active",
        email: "teacher@school.edu",
        authEmailConfirmed: true,
      }),
      "none",
    );
    assert.equal(
      canSendActiveStaffPasswordReset({
        profileId: "11111111-1111-1111-1111-111111111111",
        displayStatus: "active",
        email: "teacher@school.edu",
      }),
      true,
    );
    assert.equal(
      canSendActiveStaffPasswordReset({
        profileId: null,
        displayStatus: "account_exists",
        email: "teacher@school.edu",
      }),
      false,
    );
  });

  it("draft without email → Edit", () => {
    assert.equal(
      resolveStaffDirectoryAccessAction({
        profileId: null,
        displayStatus: "draft",
        email: null,
      }),
      "edit",
    );
  });

  it("ready with email → Send invitation", () => {
    assert.equal(
      resolveStaffDirectoryAccessAction({
        profileId: null,
        displayStatus: "ready",
        email: "teacher@school.edu",
        canSendNewInvite: true,
      }),
      "send_invite",
    );
  });
});

describe("Access Status inline Send invitation", () => {
  it("Ready to invite renders Send invitation", () => {
    assert.equal(
      canSendStaffNewInvitation({
        profileId: null,
        displayStatus: "ready",
        email: "teacher@school.edu",
      }),
      true,
    );
    const controls = resolveStaffInviteStatusInlineControls({
      profileId: null,
      displayStatus: "ready",
      email: "teacher@school.edu",
    });
    assert.deepEqual(controls, [
      { kind: "send_invite", label: "Send invitation", disabled: false },
    ]);
  });

  it("Draft does not render Send invitation", () => {
    assert.equal(
      canSendStaffNewInvitation({
        profileId: null,
        displayStatus: "draft",
        email: "teacher@school.edu",
        canSendNewInvite: true,
      }),
      false,
    );
    const controls = resolveStaffInviteStatusInlineControls({
      profileId: null,
      displayStatus: "draft",
      email: "teacher@school.edu",
      canSendNewInvite: true,
    });
    assert.equal(
      controls.some((c) => c.kind === "send_invite"),
      false,
    );
  });

  it("Active does not render Send invitation (keeps password reset)", () => {
    assert.equal(
      canSendStaffNewInvitation({
        profileId: "11111111-1111-1111-1111-111111111111",
        displayStatus: "active",
        email: "teacher@school.edu",
      }),
      false,
    );
    const controls = resolveStaffInviteStatusInlineControls({
      profileId: "11111111-1111-1111-1111-111111111111",
      displayStatus: "active",
      email: "teacher@school.edu",
    });
    assert.equal(
      controls.some((c) => c.kind === "send_invite"),
      false,
    );
    assert.deepEqual(controls, [
      { kind: "send_password_reset", label: "Send password reset", disabled: false },
    ]);
  });

  it("successful send gates action away — Invitation sent no longer shows Send invitation", () => {
    assert.equal(
      canSendStaffNewInvitation({
        profileId: null,
        displayStatus: "invitation_sent",
        email: "teacher@school.edu",
      }),
      false,
    );
    const afterSuccess = resolveStaffInviteStatusInlineControls({
      profileId: null,
      displayStatus: "invitation_sent",
      email: "teacher@school.edu",
      authEmailConfirmed: false,
    });
    assert.equal(
      afterSuccess.some((c) => c.kind === "send_invite"),
      false,
    );
    assert.equal(afterSuccess.some((c) => c.kind === "resend_invite"), true);
    assert.equal(staffRosterStatusLabel("invitation_sent"), "Invited");
  });

  it("failed send leaves Ready to invite eligible for Send invitation", () => {
    // Failure does not change displayStatus — row stays ready and actionable.
    assert.equal(
      canSendStaffNewInvitation({
        profileId: null,
        displayStatus: "ready",
        email: "teacher@school.edu",
      }),
      true,
    );
    const stillEligible = resolveStaffInviteStatusInlineControls({
      profileId: null,
      displayStatus: "ready",
      email: "teacher@school.edu",
    });
    assert.deepEqual(stillEligible, [
      { kind: "send_invite", label: "Send invitation", disabled: false },
    ]);
    // Error copy still comes from existing invite failure helpers (toast path).
    assert.match(
      messageForStaffInviteEmailFailure("smtp failure", { forResend: false }),
      /could not be sent/i,
    );
  });

  it("action cannot be double-submitted while pending (Sending… + disabled)", () => {
    const controls = resolveStaffInviteStatusInlineControls({
      profileId: null,
      displayStatus: "ready",
      email: "teacher@school.edu",
      pending: true,
    });
    assert.deepEqual(controls, [
      { kind: "send_invite", label: "Sending…", disabled: true },
    ]);
  });
});

describe("canResendStaffMemberInvitation", () => {
  it("allows pending invitation_sent staff without a profile", () => {
    assert.equal(
      canResendStaffMemberInvitation({
        profileId: null,
        displayStatus: "invitation_sent",
        email: "teacher@school.edu",
      }),
      true,
    );
  });

  it("allows opened invitations", () => {
    assert.equal(
      canResendStaffMemberInvitation({
        profileId: null,
        displayStatus: "opened",
        email: "teacher@school.edu",
      }),
      true,
    );
  });

  it("blocks active staff with a linked profile", () => {
    assert.equal(
      canResendStaffMemberInvitation({
        profileId: "11111111-1111-1111-1111-111111111111",
        displayStatus: "active",
        email: "teacher@school.edu",
      }),
      false,
    );
  });

  it("blocks active display even if status string were wrong", () => {
    assert.equal(
      canResendStaffMemberInvitation({
        profileId: "11111111-1111-1111-1111-111111111111",
        displayStatus: "invitation_sent",
        email: "teacher@school.edu",
      }),
      false,
    );
  });

  it("blocks missing email", () => {
    assert.equal(
      canResendStaffMemberInvitation({
        profileId: null,
        displayStatus: "invitation_sent",
        email: "  ",
      }),
      false,
    );
  });

  it("blocks archived and disabled", () => {
    assert.equal(
      canResendStaffMemberInvitation({
        profileId: null,
        archivedAt: "2026-01-01T00:00:00.000Z",
        displayStatus: "invitation_sent",
        email: "teacher@school.edu",
      }),
      false,
    );
    assert.equal(
      canResendStaffMemberInvitation({
        profileId: null,
        membershipStatus: "disabled",
        displayStatus: "disabled",
        email: "teacher@school.edu",
      }),
      false,
    );
  });
});

describe("staff roster invitation labels and send eligibility", () => {
  it("labels pending invitations and account-exists clearly", () => {
    assert.equal(staffRosterStatusLabel("draft"), "Draft");
    assert.equal(staffRosterStatusLabel("ready"), "Ready to invite");
    assert.equal(staffRosterStatusLabel("invitation_sent"), "Invited");
    assert.equal(staffRosterStatusLabel("opened"), "Invited · opened");
    assert.equal(staffRosterStatusLabel("account_exists"), "Setup needed");
    assert.equal(staffRosterStatusLabel("accepted"), "Setup needed");
    assert.equal(staffRosterStatusLabel("active"), "Active");
  });

  it("resolves confirmed Auth + unlinked staff to account_exists", () => {
    assert.equal(
      resolveStaffRosterDisplayStatus({
        membershipStatus: "ready",
        profileId: null,
        authEmailConfirmed: true,
        latestInvite: { status: "pending", expires_at: null },
      }),
      "account_exists",
    );
  });

  it("keeps invitation_sent when Auth is unconfirmed", () => {
    assert.equal(
      resolveStaffRosterDisplayStatus({
        membershipStatus: "ready",
        profileId: null,
        authEmailConfirmed: false,
        latestInvite: { status: "pending", expires_at: null },
      }),
      "invitation_sent",
    );
  });

  it("does not allow a new invite while one is already pending (use resend)", () => {
    assert.equal(
      canSendStaffInvitation({
        membershipStatus: "ready",
        profileId: null,
        email: "teacher@school.edu",
        latestInvite: { status: "pending", expires_at: null },
      }),
      false,
    );
  });

  it("does not allow inviteUserByEmail path for active linked profiles", () => {
    assert.equal(
      canSendStaffInvitation({
        membershipStatus: "ready",
        profileId: "11111111-1111-1111-1111-111111111111",
        email: "teacher@school.edu",
        latestInvite: null,
      }),
      false,
    );
  });
});

describe("production redirect helpers (canonical setup-password)", () => {
  it("documents that confirmed accounts are guided to a setup link, not resend", () => {
    assert.equal(
      typeof messageForStaffInviteEmailFailure("already registered"),
      "string",
    );
    assert.match(
      messageForStaffInviteEmailFailure("already registered"),
      /setup link/i,
    );
  });
});
