/** Singleton row id — matches `school_settings_singleton_id_chk` in migrations. */
export const SCHOOL_SETTINGS_ID = "00000000-0000-4000-8000-000000000001";

export const SCHOOL_LOGOS_BUCKET = "school-logos";

/** Fixed object name in the bucket; extension varies by upload. */
export const SCHOOL_LOGO_OBJECT_PREFIX = "logo.";

export const MAX_SCHOOL_LOGO_BYTES = 2 * 1024 * 1024;

export const SCHOOL_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

/** Shown on report cards when `school_name` is empty. */
export const REPORT_CARD_SCHOOL_NAME_FALLBACK = "Your school";
