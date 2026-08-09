/**
 * User-facing error copy helpers.
 * Log technical detail server-side; never surface raw Postgres / PostgREST text.
 */

/** Canonical load failure copy for UI — never include schema / PostgREST detail. */
export const GENERIC_INFORMATION_LOAD_ERROR =
  "We couldn’t load this information. Try again.";

const RAW_DB_MARKERS = [
  "column",
  "does not exist",
  "schema cache",
  "permission denied",
  "violates",
  "relation",
  "PGRST",
  "duplicate key",
  "foreign key",
  "null value",
  "syntax error",
  "JWT",
] as const;

export function logServerError(scope: string, detail: unknown) {
  const message =
    detail instanceof Error
      ? detail.message
      : typeof detail === "string"
        ? detail
        : detail == null
          ? "unknown"
          : JSON.stringify(detail);
  console.error(`[${scope}] ${message}`);
}

export function looksLikeRawDbError(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return RAW_DB_MARKERS.some((marker) =>
    marker === "PGRST" || marker === "JWT"
      ? trimmed.includes(marker)
      : lower.includes(marker.toLowerCase()),
  );
}

/**
 * Returns a safe message for UI. Prefer a specific `fallback`; only pass through
 * intentional product validation copy that is not a DB dump.
 */
export function safeUserFacingMessage(
  raw: string | null | undefined,
  fallback: string,
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || looksLikeRawDbError(trimmed)) return fallback;
  return trimmed;
}
