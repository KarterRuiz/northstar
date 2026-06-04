import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type StaffInvitationRow =
  Database["public"]["Tables"]["staff_invitations"]["Row"];

export type StaffInvitationsResult = {
  rows: StaffInvitationRow[];
  error: string | null;
};

export const fetchStaffInvitations = cache(
  async (): Promise<StaffInvitationsResult> => {
    if (!isSupabaseConfigured()) {
      return { rows: [], error: "Supabase is not configured." };
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("staff_invitations")
      .select(
        "id, email, full_name, role, status, invited_by, accepted_user_id, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      return { rows: [], error: error.message };
    }

    const rows = [...(data ?? [])];
    const rank = (s: string) =>
      s === "pending" ? 0 : s === "accepted" ? 1 : s === "cancelled" ? 2 : 3;
    rows.sort((a, b) => {
      const d = rank(a.status) - rank(b.status);
      if (d !== 0) return d;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return { rows, error: null };
  },
);
