/**
 * Extensible roster field catalog.
 *
 * Importable fields write to NorthStar today.
 * Catalogued fields are recognized (aliases, validation) for future imports
 * without redesigning the parse → map → validate → plan → apply pipeline.
 */

export type RosterFieldStatus = "importable" | "catalogued";

export type RosterFieldId =
  | "first_name"
  | "last_name"
  | "preferred_name"
  | "english_name"
  | "chinese_name"
  | "student_number"
  | "external_id"
  | "grade"
  | "class"
  | "date_of_birth"
  | "gender"
  | "parent_names"
  | "parent_emails"
  | "parent_phones"
  | "emergency_contact"
  | "guardian_relationship"
  | "photo_url"
  | "medical_flags"
  | "house_team"
  | "homeroom_teacher"
  | "languages"
  | "nationality"
  | "passport"
  | "accommodations";

export type RosterFieldDefinition = {
  id: RosterFieldId;
  label: string;
  /** Header aliases (normalized lowercase, punctuation stripped). */
  aliases: readonly string[];
  required: boolean;
  status: RosterFieldStatus;
  description?: string;
};

export const ROSTER_FIELD_CATALOG: readonly RosterFieldDefinition[] = [
  {
    id: "first_name",
    label: "First Name",
    aliases: ["first name", "firstname", "given name", "givenname", "first"],
    required: true,
    status: "importable",
  },
  {
    id: "last_name",
    label: "Last Name",
    aliases: ["last name", "lastname", "family name", "familyname", "surname", "last"],
    required: true,
    status: "importable",
  },
  {
    id: "preferred_name",
    label: "Preferred Name",
    aliases: ["preferred name", "preferredname", "preferred", "nickname", "goes by"],
    required: false,
    status: "importable",
  },
  {
    id: "english_name",
    label: "English Name",
    aliases: ["english name", "englishname", "en name", "name en"],
    required: false,
    status: "importable",
    description: "Used as preferred name when preferred name is blank.",
  },
  {
    id: "chinese_name",
    label: "Chinese Name",
    aliases: ["chinese name", "chinesename", "cn name", "name cn", "name zh"],
    required: false,
    status: "catalogued",
  },
  {
    id: "student_number",
    label: "Student Number",
    aliases: [
      "student number",
      "studentnumber",
      "student id",
      "studentid",
      "student #",
      "stu id",
      "sis id",
    ],
    required: false,
    status: "importable",
    description: "Maps to the student number (external ID) in NorthStar.",
  },
  {
    id: "external_id",
    label: "External ID",
    aliases: ["external id", "externalid", "ext id", "legacy id", "source id"],
    required: false,
    status: "importable",
    description: "Alternate student number column; student number wins if both are mapped.",
  },
  {
    id: "grade",
    label: "Grade",
    aliases: ["grade", "grade level", "gradelevel", "year group", "yeargroup", "year"],
    required: false,
    status: "importable",
  },
  {
    id: "class",
    label: "Class",
    aliases: [
      "class",
      "class name",
      "classname",
      "homeroom",
      "home room",
      "section",
      "class section",
      "cohort",
    ],
    required: true,
    status: "importable",
  },
  {
    id: "date_of_birth",
    label: "Date of Birth",
    aliases: ["date of birth", "dob", "birth date", "birthdate", "birthday"],
    required: false,
    status: "catalogued",
  },
  {
    id: "gender",
    label: "Gender",
    aliases: ["gender", "sex"],
    required: false,
    status: "catalogued",
  },
  {
    id: "parent_names",
    label: "Parent Names",
    aliases: [
      "parent names",
      "parent name",
      "parents",
      "guardian names",
      "guardian name",
      "guardians",
    ],
    required: false,
    status: "catalogued",
  },
  {
    id: "parent_emails",
    label: "Parent Emails",
    aliases: [
      "parent emails",
      "parent email",
      "emails",
      "email",
      "guardian email",
      "guardian emails",
      "parent email address",
    ],
    required: false,
    status: "catalogued",
  },
  {
    id: "parent_phones",
    label: "Parent Phones",
    aliases: [
      "parent phones",
      "parent phone",
      "phones",
      "phone",
      "mobile",
      "guardian phone",
      "guardian phones",
    ],
    required: false,
    status: "catalogued",
  },
  {
    id: "emergency_contact",
    label: "Emergency Contact",
    aliases: [
      "emergency contact",
      "emergencycontact",
      "emergency",
      "ice contact",
      "in case of emergency",
    ],
    required: false,
    status: "catalogued",
  },
  {
    id: "guardian_relationship",
    label: "Guardian Relationship",
    aliases: ["guardian relationship", "relationship", "relation"],
    required: false,
    status: "catalogued",
  },
  {
    id: "photo_url",
    label: "Photo",
    aliases: ["photo", "photo url", "photourl", "headshot", "image url"],
    required: false,
    status: "catalogued",
  },
  {
    id: "medical_flags",
    label: "Medical Flags",
    aliases: ["medical flags", "medical", "allergies", "health notes", "medical notes"],
    required: false,
    status: "catalogued",
  },
  {
    id: "house_team",
    label: "House / Team",
    aliases: ["house", "team", "house team", "houseteam", "house/team"],
    required: false,
    status: "catalogued",
  },
  {
    id: "homeroom_teacher",
    label: "Homeroom Teacher",
    aliases: ["homeroom teacher", "homeroomteacher", "class teacher", "teacher"],
    required: false,
    status: "catalogued",
  },
  {
    id: "languages",
    label: "Languages",
    aliases: ["languages", "language", "home language", "mother tongue"],
    required: false,
    status: "catalogued",
  },
  {
    id: "nationality",
    label: "Nationality",
    aliases: ["nationality", "citizenship", "country"],
    required: false,
    status: "catalogued",
  },
  {
    id: "passport",
    label: "Passport",
    aliases: ["passport", "passport number", "passport no"],
    required: false,
    status: "catalogued",
  },
  {
    id: "accommodations",
    label: "Accommodations",
    aliases: ["accommodations", "accommodation", "iep", "support needs", "learning support"],
    required: false,
    status: "catalogued",
  },
] as const;

export const IMPORTABLE_FIELD_IDS = ROSTER_FIELD_CATALOG.filter(
  (f) => f.status === "importable",
).map((f) => f.id);

export const REQUIRED_FIELD_IDS = ROSTER_FIELD_CATALOG.filter((f) => f.required).map(
  (f) => f.id,
);

const catalogById = new Map(ROSTER_FIELD_CATALOG.map((f) => [f.id, f]));

export function getRosterField(id: RosterFieldId): RosterFieldDefinition {
  const field = catalogById.get(id);
  if (!field) throw new Error(`Unknown roster field: ${id}`);
  return field;
}

/** Normalize a CSV/Excel header for alias matching. */
export function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_./\\]+/g, " ")
    .replace(/[#]+/g, " # ")
    .replace(/[^a-z0-9#\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build alias → field id lookup (longer aliases preferred via first-write). */
export function buildAliasLookup(): Map<string, RosterFieldId> {
  const entries: { alias: string; id: RosterFieldId; len: number }[] = [];
  for (const field of ROSTER_FIELD_CATALOG) {
    for (const alias of field.aliases) {
      const key = normalizeHeaderKey(alias);
      if (!key) continue;
      entries.push({ alias: key, id: field.id, len: key.length });
    }
    // Also match the display label.
    entries.push({
      alias: normalizeHeaderKey(field.label),
      id: field.id,
      len: normalizeHeaderKey(field.label).length,
    });
  }
  entries.sort((a, b) => b.len - a.len);
  const map = new Map<string, RosterFieldId>();
  for (const e of entries) {
    if (!map.has(e.alias)) map.set(e.alias, e.id);
  }
  return map;
}

export const TEMPLATE_HEADERS = [
  "First Name",
  "Last Name",
  "Preferred Name",
  "English Name",
  "Chinese Name",
  "Student Number",
  "External ID",
  "Grade",
  "Class",
  "Date of Birth",
  "Gender",
  "Parent Names",
  "Parent Emails",
  "Parent Phones",
  "Emergency Contact",
] as const;
