import "server-only";

import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type StaffProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "role" | "full_name" | "email" | "is_active" | "created_at" | "updated_at"
>;

export type StaffDirectoryPage = {
  rows: StaffProfileRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  error: string | null;
};

const DEFAULT_PAGE_SIZE = 25;

function clampPage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export const fetchStaffDirectoryPage = cache(
  async (searchParams: {
    page?: string | string[];
  }): Promise<StaffDirectoryPage> => {
    const page = clampPage(
      typeof searchParams.page === "string"
        ? searchParams.page
        : Array.isArray(searchParams.page)
          ? searchParams.page[0]
          : undefined,
    );
    const pageSize = DEFAULT_PAGE_SIZE;

    if (!isSupabaseConfigured()) {
      return {
        rows: [],
        totalCount: 0,
        page: 1,
        pageSize,
        error: "Supabase is not configured.",
      };
    }

    const supabase = await createServerSupabaseClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const [listRes, countRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, role, full_name, email, is_active, created_at, updated_at")
        .order("role", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    const err =
      listRes.error?.message ??
      countRes.error?.message ??
      null;

    return {
      rows: (listRes.data ?? []) as StaffProfileRow[],
      totalCount: countRes.count ?? 0,
      page,
      pageSize,
      error: err,
    };
  },
);
