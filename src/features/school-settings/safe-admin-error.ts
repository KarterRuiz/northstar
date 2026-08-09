/**
 * Administrator-facing error copy for School Settings.
 * Logs technical detail server-side; never returns raw Postgres/schema text to the UI.
 */

import {
  logServerError,
  safeUserFacingMessage,
} from "@/lib/errors/safe-user-message";

export function logSchoolSettingsError(scope: string, detail: unknown) {
  logServerError(`school-settings.${scope}`, detail);
}

/** Known uniqueness / constraint copy; otherwise a generic fallback. */
export function schoolYearDbErrorMessage(message: string, fallback: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("unique") || lower.includes("23505")) {
    return "A school year with this label already exists. Choose a different label.";
  }
  return safeUserFacingMessage(message, fallback);
}

export function schoolSettingsDbErrorMessage(message: string, fallback: string): string {
  return safeUserFacingMessage(message, fallback);
}
