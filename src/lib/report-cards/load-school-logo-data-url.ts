import "server-only";

import { SCHOOL_LOGOS_BUCKET } from "@/lib/school-settings/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "image/png";
}

/** Embeds the school logo for Puppeteer (avoids expiring signed URLs in PDF HTML). */
export async function loadSchoolLogoDataUrl(
  logoStoragePath: string | null,
): Promise<string | null> {
  if (!logoStoragePath?.trim()) return null;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(SCHOOL_LOGOS_BUCKET)
    .download(logoStoragePath.trim());

  if (error || !data) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  const mime = mimeFromPath(logoStoragePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
