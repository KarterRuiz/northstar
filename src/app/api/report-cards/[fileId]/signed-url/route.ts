import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit";
import { REPORT_CARDS_BUCKET } from "@/lib/report-cards/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/students/uuid";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SEC = 60 * 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await context.params;
  if (!isUuid(fileId)) {
    return NextResponse.json({ error: "Invalid file id." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: row, error: rowError } = await supabase
    .from("report_card_files")
    .select("id, student_id, storage_path")
    .eq("id", fileId)
    .maybeSingle();

  if (rowError || !row) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(REPORT_CARDS_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SEC);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signError?.message ?? "Could not create signed URL." },
      { status: 403 },
    );
  }

  await recordAuditEvent({
    action: "report_card_downloaded",
    actorUserId: user.id,
    metadata: {
      fileId: row.id,
      studentId: row.student_id,
      storagePath: row.storage_path,
    },
  });

  return NextResponse.json({
    signedUrl: signed.signedUrl,
    expiresIn: SIGNED_URL_TTL_SEC,
  });
}
