import "server-only";

import { SCHOOL_LOGOS_BUCKET } from "@/lib/school-settings/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function loadSchoolLogoPreviewUrl(
  logoStoragePath: string | null,
): Promise<string | null> {
  if (!logoStoragePath?.trim()) return null;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase.storage
    .from(SCHOOL_LOGOS_BUCKET)
    .createSignedUrl(logoStoragePath.trim(), 3600);

  return data?.signedUrl ?? null;
}
