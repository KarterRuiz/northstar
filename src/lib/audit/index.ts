export { recordAuditEvent } from "./logger";
export type { RecordAuditEventOptions } from "./logger";
export type {
  AuditAction,
  AuditEventInput,
  AuditMetadataObject,
  AuditMetadataPrimitive,
} from "./types";
export { auditActions } from "./types";

import { recordAuditEvent } from "./logger";
import type { AuditEventInput } from "./types";

type GradeMetadata = Extract<AuditEventInput, { action: "grade_changed" }>["metadata"];
type ExportMetadata = Extract<AuditEventInput, { action: "records_exported" }>["metadata"];

/**
 * Integration hook: invoke from the grades module after a grade is successfully saved.
 */
export async function auditAfterGradeChanged(
  metadata: GradeMetadata,
  opts?: { actorUserId?: string; strict?: boolean },
): Promise<void> {
  await recordAuditEvent(
    { action: "grade_changed", actorUserId: opts?.actorUserId, metadata },
    { strict: opts?.strict },
  );
}

/**
 * Integration hook: invoke from the records export pipeline after a successful export.
 */
export async function auditAfterRecordsExported(
  metadata: ExportMetadata,
  opts?: { actorUserId?: string; strict?: boolean },
): Promise<void> {
  await recordAuditEvent(
    { action: "records_exported", actorUserId: opts?.actorUserId, metadata },
    { strict: opts?.strict },
  );
}
