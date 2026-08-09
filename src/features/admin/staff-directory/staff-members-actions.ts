"use server";

import { revalidatePath } from "next/cache";

import { isRole } from "@/config/roles";
import { recordAuditEvent } from "@/lib/audit";
import { getStaffDirectoryManagerActor } from "@/lib/auth/require-staff-directory-manager";
import { staffDirectoryPath } from "@/features/admin/staff-directory/staff-directory-path";
import { checkStaffDeletable } from "@/features/admin/staff-directory/staff-lifecycle";
import { resolveStaffMembershipStatusAfterEdit } from "@/lib/staff/staff-roster-status";
import { isUuid } from "@/lib/students/uuid";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidEmailFormat } from "@/lib/validation/is-valid-email-format";

const DUPLICATE_STAFF_EMAIL_MESSAGE =
  "Another staff member already uses this email address.";

export type StaffMemberActionState =
  | { ok: true; message?: string; staffMemberId?: string }
  | { ok: false; message: string };

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function composeFullName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(" ").trim();
}

function parseUuidFieldList(formData: FormData, fieldName: string): string[] {
  const raw = formData.getAll(fieldName);
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (isUuid(id)) out.push(id);
  }
  return [...new Set(out)];
}

async function filterClassIdsToGrades(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  classIds: string[],
  gradeLevelIds: string[],
): Promise<string[]> {
  if (classIds.length === 0 || gradeLevelIds.length === 0) return [];
  const { data, error } = await supabase
    .from("classes")
    .select("id, grade_level_id")
    .in("id", classIds)
    .in("grade_level_id", gradeLevelIds);
  if (error || !data) return [];
  const allowed = new Set(data.map((r) => r.id));
  return classIds.filter((id) => allowed.has(id));
}

async function replaceStaffMemberAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  staffMemberId: string,
  role: string,
  gradeLevelIds: string[],
  classIds: string[],
  profileId?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const teacherGrades = role === "teacher" ? gradeLevelIds : [];
  const teacherClasses = role === "teacher" ? classIds : [];

  const { error: delGrades } = await supabase
    .from("staff_member_grade_levels")
    .delete()
    .eq("staff_member_id", staffMemberId);
  if (delGrades) {
    return { ok: false, message: "Could not update grade permissions." };
  }
  const { error: delClasses } = await supabase
    .from("staff_member_classes")
    .delete()
    .eq("staff_member_id", staffMemberId);
  if (delClasses) {
    return { ok: false, message: "Could not update class permissions." };
  }

  if (teacherGrades.length > 0) {
    const { error } = await supabase.from("staff_member_grade_levels").insert(
      teacherGrades.map((grade_level_id) => ({
        staff_member_id: staffMemberId,
        grade_level_id,
      })),
    );
    if (error) return { ok: false, message: "Could not save grade permissions." };
  }

  if (teacherClasses.length > 0) {
    const { error } = await supabase.from("staff_member_classes").insert(
      teacherClasses.map((class_id) => ({
        staff_member_id: staffMemberId,
        class_id,
      })),
    );
    if (error) return { ok: false, message: "Could not save class permissions." };
  }

  // Mirror onto live profile access when activated; otherwise keep pending invite snapshot aligned.
  if (profileId) {
    await supabase.from("staff_grade_levels").delete().eq("profile_id", profileId);
    if (teacherGrades.length > 0) {
      const { error } = await supabase.from("staff_grade_levels").insert(
        teacherGrades.map((grade_level_id) => ({
          profile_id: profileId,
          grade_level_id,
        })),
      );
      if (error) return { ok: false, message: "Could not sync live grade access." };
    }

    await supabase.from("class_teachers").delete().eq("teacher_profile_id", profileId);
    if (teacherClasses.length > 0) {
      const { error } = await supabase.from("class_teachers").insert(
        teacherClasses.map((class_id) => ({
          class_id,
          teacher_profile_id: profileId,
          role: "co_teacher" as const,
        })),
      );
      if (error) return { ok: false, message: "Could not sync live class access." };
    }
  } else {
    await supabase
      .from("staff_invitations")
      .update({
        pending_grade_level_ids: teacherGrades,
        pending_class_ids: teacherClasses,
      })
      .eq("staff_member_id", staffMemberId)
      .eq("status", "pending");
  }

  return { ok: true };
}

/**
 * Creates a staff roster row only — no invitation email, no auth user, no onboarding.
 */
export async function createStaffMemberAction(
  _prev: StaffMemberActionState | undefined,
  formData: FormData,
): Promise<StaffMemberActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in with permission to manage staff." };
  }

  const firstNameRaw = formData.get("firstName");
  const lastNameRaw = formData.get("lastName");
  const emailRaw = formData.get("email");
  const roleRaw = formData.get("role");
  const noteRaw = formData.get("staffNote");
  const asDraftRaw = formData.get("asDraft");

  if (
    typeof firstNameRaw !== "string" ||
    typeof lastNameRaw !== "string" ||
    typeof roleRaw !== "string"
  ) {
    return { ok: false, message: "Missing name or role." };
  }

  const firstName = firstNameRaw.trim();
  const lastName = lastNameRaw.trim();
  const fullName = composeFullName(firstName, lastName);
  const emailInput = typeof emailRaw === "string" ? normalizeEmail(emailRaw) : "";
  const email = emailInput.length > 0 ? emailInput : null;
  const role = roleRaw.trim();
  const notes =
    typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim() : null;
  const forceDraft = asDraftRaw === "true";

  if (!firstName || !lastName || !fullName) {
    return { ok: false, message: "First and last name are required." };
  }
  if (email && !isValidEmailFormat(email)) {
    return { ok: false, message: "Enter a valid email address, or leave email blank." };
  }
  if (!isRole(role)) {
    return { ok: false, message: "That role is not allowed." };
  }

  const gradeLevelIds = role === "teacher" ? parseUuidFieldList(formData, "gradeLevelIds") : [];
  const rawClassIds = role === "teacher" ? parseUuidFieldList(formData, "classIds") : [];
  const classIds =
    role === "teacher"
      ? await filterClassIdsToGrades(supabase, rawClassIds, gradeLevelIds)
      : [];

  // No email → draft / not invited. With email → ready (unless forced draft).
  const status = forceDraft || !email ? "draft" : "ready";

  const { data: inserted, error } = await supabase
    .from("staff_members")
    .insert({
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      email,
      role,
      status,
      notes,
      created_by: actor.userId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: DUPLICATE_STAFF_EMAIL_MESSAGE };
    }
    return { ok: false, message: "Could not add staff. Try again." };
  }
  if (!inserted?.id) {
    return { ok: false, message: "Staff record was not created." };
  }

  const access = await replaceStaffMemberAccess(
    supabase,
    inserted.id,
    role,
    gradeLevelIds,
    classIds,
  );
  if (!access.ok) {
    await supabase.from("staff_members").delete().eq("id", inserted.id);
    return access;
  }

  await recordAuditEvent({
    action: "staff_profile_updated",
    actorUserId: actor.userId,
    metadata: {
      targetUserId: inserted.id,
      changedSummary: `Created staff roster row for ${fullName} (${role})`,
      staffMemberId: inserted.id,
      email: email ?? "",
      role,
      op: "created",
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  return {
    ok: true,
    staffMemberId: inserted.id,
    message: email
      ? "Staff added to the directory. Send an invitation when they are ready to activate."
      : "Staff added without email. Add an email later, then send an invitation.",
  };
}

export async function updateStaffMemberAction(
  _prev: StaffMemberActionState | undefined,
  formData: FormData,
): Promise<StaffMemberActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in with permission to manage staff." };
  }

  const idRaw = formData.get("staffMemberId");
  const firstNameRaw = formData.get("firstName");
  const lastNameRaw = formData.get("lastName");
  const emailRaw = formData.get("email");
  const roleRaw = formData.get("role");
  const noteRaw = formData.get("staffNote");
  const confirmLoginEmailChange = formData.get("confirmLoginEmailChange") === "true";

  if (
    typeof idRaw !== "string" ||
    typeof firstNameRaw !== "string" ||
    typeof lastNameRaw !== "string" ||
    typeof roleRaw !== "string"
  ) {
    return { ok: false, message: "Missing staff fields." };
  }

  const staffMemberId = idRaw.trim();
  if (!isUuid(staffMemberId)) {
    return { ok: false, message: "Invalid staff member." };
  }

  const firstName = firstNameRaw.trim();
  const lastName = lastNameRaw.trim();
  const fullName = composeFullName(firstName, lastName);
  const emailInput = typeof emailRaw === "string" ? normalizeEmail(emailRaw) : "";
  const email = emailInput.length > 0 ? emailInput : null;
  const role = roleRaw.trim();
  const notes =
    typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim() : null;

  if (!firstName || !lastName || !fullName) {
    return { ok: false, message: "First and last name are required." };
  }
  if (email && !isValidEmailFormat(email)) {
    return { ok: false, message: "Enter a valid email address, or leave email blank." };
  }
  if (!isRole(role)) {
    return { ok: false, message: "That role is not allowed." };
  }

  const gradeLevelIds = role === "teacher" ? parseUuidFieldList(formData, "gradeLevelIds") : [];
  const rawClassIds = role === "teacher" ? parseUuidFieldList(formData, "classIds") : [];
  const classIds =
    role === "teacher"
      ? await filterClassIdsToGrades(supabase, rawClassIds, gradeLevelIds)
      : [];

  const { data: existing, error: readError } = await supabase
    .from("staff_members")
    .select("id, profile_id, status, email, first_name, last_name, role")
    .eq("id", staffMemberId)
    .maybeSingle();

  if (readError || !existing) {
    return { ok: false, message: "Staff member not found." };
  }
  if (existing.status === "archived") {
    return { ok: false, message: "Archived staff cannot be edited. Restore them first." };
  }

  const previousEmail = existing.email ? normalizeEmail(existing.email) : null;
  const emailChanged = previousEmail !== email;

  // Linked accounts: changing login email requires explicit confirmation — never silent.
  if (existing.profile_id && emailChanged) {
    if (!email) {
      return {
        ok: false,
        message:
          "This person already has a sign-in account. Keep their email — clearing it would break sign-in.",
      };
    }
    if (!confirmLoginEmailChange) {
      return {
        ok: false,
        message:
          "This person is linked to a sign-in account. Check “Also update sign-in email” to change their login email, or leave the email unchanged.",
      };
    }
  }

  if (email && emailChanged) {
    const { data: clash } = await supabase
      .from("staff_members")
      .select("id")
      .neq("id", staffMemberId)
      .is("archived_at", null)
      .eq("email", email)
      .maybeSingle();
    if (clash?.id) {
      return { ok: false, message: DUPLICATE_STAFF_EMAIL_MESSAGE };
    }
  }

  const nextStatus = resolveStaffMembershipStatusAfterEdit({
    currentStatus: existing.status,
    hasEmail: Boolean(email),
  });

  const { error: updateError } = await supabase
    .from("staff_members")
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      email,
      role,
      notes,
      status: nextStatus,
    })
    .eq("id", staffMemberId);

  if (updateError) {
    if (updateError.code === "23505") {
      return { ok: false, message: DUPLICATE_STAFF_EMAIL_MESSAGE };
    }
    return { ok: false, message: "Could not update staff. Try again." };
  }

  const access = await replaceStaffMemberAccess(
    supabase,
    staffMemberId,
    role,
    gradeLevelIds,
    classIds,
    existing.profile_id,
  );
  if (!access.ok) {
    // Roll identity fields back so a partial access failure does not strand the row.
    await supabase
      .from("staff_members")
      .update({
        first_name: existing.first_name,
        last_name: existing.last_name,
        email: previousEmail,
        role: existing.role,
        status: existing.status,
      })
      .eq("id", staffMemberId);
    return access;
  }

  // Keep pending invitation snapshot in sync when not yet accepted.
  if (!existing.profile_id) {
    if (!email) {
      await supabase
        .from("staff_invitations")
        .update({ status: "cancelled" })
        .eq("staff_member_id", staffMemberId)
        .eq("status", "pending");
    } else {
      await supabase
        .from("staff_invitations")
        .update({
          email,
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          role,
          staff_note: notes,
        })
        .eq("staff_member_id", staffMemberId)
        .eq("status", "pending");
    }
  } else if (existing.profile_id) {
    if (emailChanged && email && confirmLoginEmailChange) {
      try {
        const admin = createAdminSupabaseClient();
        const { error: authErr } = await admin.auth.admin.updateUserById(existing.profile_id, {
          email,
          email_confirm: true,
        });
        if (authErr) {
          // Roll roster email back so auth and roster stay aligned.
          await supabase
            .from("staff_members")
            .update({ email: previousEmail })
            .eq("id", staffMemberId);
          return {
            ok: false,
            message: authErr.message || "Could not update the sign-in email.",
          };
        }
      } catch {
        await supabase
          .from("staff_members")
          .update({ email: previousEmail })
          .eq("id", staffMemberId);
        return {
          ok: false,
          message: "Email could not be updated: server admin credentials are not configured.",
        };
      }
    }
    await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        ...(email && emailChanged && confirmLoginEmailChange ? { email } : {}),
        role,
      })
      .eq("id", existing.profile_id);
  }

  await recordAuditEvent({
    action: "staff_profile_updated",
    actorUserId: actor.userId,
    metadata: {
      targetUserId: existing.profile_id ?? staffMemberId,
      changedSummary: emailChanged
        ? `Updated staff roster details for ${fullName} (email ${previousEmail ?? "none"} → ${email ?? "none"})`
        : `Updated staff roster details for ${fullName}`,
      staffMemberId,
      email: email ?? "",
      role,
      emailChanged,
      loginEmailUpdated: Boolean(existing.profile_id && emailChanged && confirmLoginEmailChange),
      gradeLevelIds,
      classIds,
      op: "updated",
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  return { ok: true, message: `${fullName} updated.`, staffMemberId };
}

export async function deactivateStaffMemberAction(
  _prev: StaffMemberActionState | undefined,
  formData: FormData,
): Promise<StaffMemberActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in with permission to manage staff." };
  }

  const idRaw = formData.get("staffMemberId");
  if (typeof idRaw !== "string" || !isUuid(idRaw.trim())) {
    return { ok: false, message: "Invalid staff member." };
  }
  const staffMemberId = idRaw.trim();

  const { data: row, error } = await supabase
    .from("staff_members")
    .select("id, profile_id, status")
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error || !row) return { ok: false, message: "Staff member not found." };
  if (row.profile_id === actor.userId) {
    return { ok: false, message: "You cannot deactivate yourself." };
  }

  const { error: updErr } = await supabase
    .from("staff_members")
    .update({ status: "disabled" })
    .eq("id", staffMemberId);
  if (updErr) return { ok: false, message: "Could not deactivate staff." };

  if (row.profile_id) {
    await supabase.from("profiles").update({ is_active: false }).eq("id", row.profile_id);
  }

  // Withdraw any live pending invite.
  await supabase
    .from("staff_invitations")
    .update({ status: "cancelled" })
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending");

  await recordAuditEvent({
    action: "profile_status_changed",
    actorUserId: actor.userId,
    metadata: {
      targetUserId: row.profile_id ?? staffMemberId,
      oldActive: true,
      newActive: false,
      staffMemberId,
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  return { ok: true, message: "Staff deactivated." };
}

export async function reactivateStaffMemberAction(
  _prev: StaffMemberActionState | undefined,
  formData: FormData,
): Promise<StaffMemberActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in with permission to manage staff." };
  }

  const idRaw = formData.get("staffMemberId");
  if (typeof idRaw !== "string" || !isUuid(idRaw.trim())) {
    return { ok: false, message: "Invalid staff member." };
  }
  const staffMemberId = idRaw.trim();

  const { data: row, error } = await supabase
    .from("staff_members")
    .select("id, profile_id, status, email, first_name, last_name")
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error || !row) return { ok: false, message: "Staff member not found." };
  if (row.status === "archived") {
    return { ok: false, message: "Archived staff cannot be reactivated from here. Restore from archive first." };
  }
  if (row.status !== "disabled") {
    return { ok: false, message: "This staff member is not deactivated." };
  }

  const nextStatus = row.email?.trim() ? "ready" : "draft";
  const { error: updErr } = await supabase
    .from("staff_members")
    .update({ status: nextStatus, archived_at: null })
    .eq("id", staffMemberId);
  if (updErr) return { ok: false, message: "Could not reactivate staff." };

  if (row.profile_id) {
    await supabase.from("profiles").update({ is_active: true }).eq("id", row.profile_id);
  }

  await recordAuditEvent({
    action: "profile_status_changed",
    actorUserId: actor.userId,
    metadata: {
      targetUserId: row.profile_id ?? staffMemberId,
      oldActive: false,
      newActive: true,
      staffMemberId,
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  return { ok: true, message: "Staff reactivated." };
}

export async function archiveStaffMemberAction(
  _prev: StaffMemberActionState | undefined,
  formData: FormData,
): Promise<StaffMemberActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in with permission to manage staff." };
  }

  const idRaw = formData.get("staffMemberId");
  if (typeof idRaw !== "string" || !isUuid(idRaw.trim())) {
    return { ok: false, message: "Invalid staff member." };
  }
  const staffMemberId = idRaw.trim();

  const { data: row, error } = await supabase
    .from("staff_members")
    .select("id, profile_id")
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error || !row) return { ok: false, message: "Staff member not found." };
  if (row.profile_id === actor.userId) {
    return { ok: false, message: "You cannot archive yourself." };
  }

  if (row.profile_id) {
    await supabase.from("profiles").update({ is_active: false }).eq("id", row.profile_id);
  }

  await supabase
    .from("staff_invitations")
    .update({ status: "cancelled" })
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending");

  const { error: updErr } = await supabase
    .from("staff_members")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", staffMemberId);
  if (updErr) return { ok: false, message: "Could not archive staff." };

  await recordAuditEvent({
    action: "staff_profile_updated",
    actorUserId: actor.userId,
    metadata: {
      targetUserId: row.profile_id ?? staffMemberId,
      changedSummary: "Archived staff roster row",
      staffMemberId,
      op: "archived",
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  return { ok: true, message: "Staff archived." };
}

export async function deleteStaffMemberAction(
  _prev: StaffMemberActionState | undefined,
  formData: FormData,
): Promise<StaffMemberActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You must be signed in with permission to manage staff." };
  }

  const idRaw = formData.get("staffMemberId");
  if (typeof idRaw !== "string" || !isUuid(idRaw.trim())) {
    return { ok: false, message: "Invalid staff member." };
  }
  const staffMemberId = idRaw.trim();

  const { data: row, error } = await supabase
    .from("staff_members")
    .select("id, profile_id, email")
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error || !row) return { ok: false, message: "Staff member not found." };
  if (row.profile_id === actor.userId) {
    return { ok: false, message: "You cannot delete yourself." };
  }

  if (row.profile_id) {
    const deletable = await checkStaffDeletable(supabase, row.profile_id);
    if (!deletable.ok) return { ok: false, message: deletable.error };
    if (!deletable.deletable) {
      return {
        ok: false,
        message: deletable.reason,
      };
    }

    try {
      const admin = createAdminSupabaseClient();
      const { error: authDel } = await admin.auth.admin.deleteUser(row.profile_id);
      if (authDel) {
        return { ok: false, message: authDel.message || "Could not delete the auth account." };
      }
    } catch {
      return {
        ok: false,
        message: "Delete requires server admin credentials. Archive or deactivate instead.",
      };
    }

    await supabase.from("profiles").delete().eq("id", row.profile_id);
  }

  const { error: delErr } = await supabase
    .from("staff_members")
    .delete()
    .eq("id", staffMemberId);
  if (delErr) {
    return { ok: false, message: "Could not delete staff. Try again." };
  }

  await recordAuditEvent({
    action: "staff_profile_deleted",
    actorUserId: actor.userId,
    metadata: {
      targetUserId: row.profile_id ?? staffMemberId,
      staffMemberId,
      ...(row.email ? { email: row.email } : {}),
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  return { ok: true, message: "Staff deleted." };
}

export async function replaceStaffMemberGradeAccessAction(
  _prev: StaffMemberActionState | undefined,
  formData: FormData,
): Promise<StaffMemberActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You do not have permission to manage grade access." };
  }

  const idRaw = formData.get("staffMemberId");
  if (typeof idRaw !== "string" || !isUuid(idRaw.trim())) {
    return { ok: false, message: "Invalid staff member." };
  }
  const staffMemberId = idRaw.trim();
  const gradeLevelIds = parseUuidFieldList(formData, "gradeLevelIds");

  const { data: member, error } = await supabase
    .from("staff_members")
    .select("id, role, profile_id, status")
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error || !member) return { ok: false, message: "Staff member not found." };
  if (member.role !== "teacher") {
    return { ok: false, message: "Grade access applies only to teachers." };
  }
  if (member.status === "archived") {
    return { ok: false, message: "Archived staff cannot be updated." };
  }

  const { error: delErr } = await supabase
    .from("staff_member_grade_levels")
    .delete()
    .eq("staff_member_id", staffMemberId);
  if (delErr) return { ok: false, message: "Could not update grade access." };

  if (gradeLevelIds.length > 0) {
    const { error: insErr } = await supabase.from("staff_member_grade_levels").insert(
      gradeLevelIds.map((grade_level_id) => ({
        staff_member_id: staffMemberId,
        grade_level_id,
      })),
    );
    if (insErr) return { ok: false, message: "Could not save grade access." };
  }

  // Mirror onto live profile access when activated.
  if (member.profile_id) {
    await supabase.from("staff_grade_levels").delete().eq("profile_id", member.profile_id);
    if (gradeLevelIds.length > 0) {
      await supabase.from("staff_grade_levels").insert(
        gradeLevelIds.map((grade_level_id) => ({
          profile_id: member.profile_id!,
          grade_level_id,
        })),
      );
    }
  } else {
    await supabase
      .from("staff_invitations")
      .update({ pending_grade_level_ids: gradeLevelIds })
      .eq("staff_member_id", staffMemberId)
      .eq("status", "pending");
  }

  await recordAuditEvent({
    action: "staff_grade_access_updated",
    actorUserId: actor.userId,
    metadata: {
      teacherProfileId: member.profile_id ?? staffMemberId,
      staffMemberId,
      gradeLevelIds,
      op: "replace",
    },
  });

  revalidatePath(staffDirectoryPath(actor.role));
  return { ok: true, message: "Grade levels updated." };
}

export async function replaceStaffMemberClassAccessAction(
  _prev: StaffMemberActionState | undefined,
  formData: FormData,
): Promise<StaffMemberActionState> {
  const supabase = await createServerSupabaseClient();
  const actor = await getStaffDirectoryManagerActor(supabase);
  if (!actor) {
    return { ok: false, message: "You do not have permission to manage class access." };
  }

  const idRaw = formData.get("staffMemberId");
  if (typeof idRaw !== "string" || !isUuid(idRaw.trim())) {
    return { ok: false, message: "Invalid staff member." };
  }
  const staffMemberId = idRaw.trim();
  const classIds = parseUuidFieldList(formData, "classIds");

  const { data: member, error } = await supabase
    .from("staff_members")
    .select("id, role, profile_id, status")
    .eq("id", staffMemberId)
    .maybeSingle();
  if (error || !member) return { ok: false, message: "Staff member not found." };
  if (member.role !== "teacher") {
    return { ok: false, message: "Class access applies only to teachers." };
  }
  if (member.status === "archived") {
    return { ok: false, message: "Archived staff cannot be updated." };
  }

  const { data: gradeRows } = await supabase
    .from("staff_member_grade_levels")
    .select("grade_level_id")
    .eq("staff_member_id", staffMemberId);
  const gradeIds = (gradeRows ?? []).map((r) => r.grade_level_id);
  const filtered = await filterClassIdsToGrades(supabase, classIds, gradeIds);

  const { error: delErr } = await supabase
    .from("staff_member_classes")
    .delete()
    .eq("staff_member_id", staffMemberId);
  if (delErr) return { ok: false, message: "Could not update class access." };

  if (filtered.length > 0) {
    const { error: insErr } = await supabase.from("staff_member_classes").insert(
      filtered.map((class_id) => ({
        staff_member_id: staffMemberId,
        class_id,
      })),
    );
    if (insErr) return { ok: false, message: "Could not save class access." };
  }

  if (member.profile_id) {
    await supabase.from("class_teachers").delete().eq("teacher_profile_id", member.profile_id);
    if (filtered.length > 0) {
      await supabase.from("class_teachers").insert(
        filtered.map((class_id) => ({
          class_id,
          teacher_profile_id: member.profile_id!,
          role: "co_teacher" as const,
        })),
      );
    }
  } else {
    await supabase
      .from("staff_invitations")
      .update({ pending_class_ids: filtered })
      .eq("staff_member_id", staffMemberId)
      .eq("status", "pending");
  }

  for (const classId of filtered) {
    await recordAuditEvent({
      action: "teacher_assigned",
      actorUserId: actor.userId,
      metadata: {
        classId,
        teacherProfileId: member.profile_id ?? staffMemberId,
        assignmentRole: "co_teacher",
        staffMemberId,
        op: "replace",
      },
    });
  }

  revalidatePath(staffDirectoryPath(actor.role));
  return { ok: true, message: "Classes updated." };
}
