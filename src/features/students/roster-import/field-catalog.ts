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
    aliases: [
      "first name",
      "firstname",
      "first_name",
      "given name",
      "givenname",
      "given_name",
      "forename",
      "first",
      "名",
      "名字",
    ],
    required: true,
    status: "importable",
  },
  {
    id: "last_name",
    label: "Last Name",
    aliases: [
      "last name",
      "lastname",
      "last_name",
      "family name",
      "familyname",
      "family_name",
      "surname",
      "last",
      "姓",
      "姓氏",
    ],
    required: true,
    status: "importable",
  },
  {
    id: "preferred_name",
    label: "Preferred Name",
    aliases: [
      "preferred name",
      "preferredname",
      "preferred_name",
      "preferred",
      "nickname",
      "goes by",
      "known as",
    ],
    required: false,
    status: "importable",
  },
  {
    id: "english_name",
    label: "English Name",
    aliases: [
      "english name",
      "englishname",
      "english_name",
      "en name",
      "name en",
      "name (english)",
      "english",
      "英文名",
      "英文名字",
    ],
    required: false,
    status: "importable",
    description: "Used as preferred name when preferred name is blank. Not treated as first/last name.",
  },
  {
    id: "chinese_name",
    label: "Chinese Name",
    aliases: [
      "chinese name",
      "chinesename",
      "chinese_name",
      "cn name",
      "name cn",
      "name zh",
      "name (chinese)",
      "中文名",
      "中文姓名",
      "中文名字",
    ],
    required: false,
    status: "catalogued",
  },
  {
    id: "student_number",
    label: "Student Number",
    aliases: [
      "student number",
      "studentnumber",
      "student_number",
      "student id",
      "studentid",
      "student_id",
      "student-id",
      "student #",
      "stu id",
      "stu number",
      "sis id",
      "sisid",
      "admission number",
      "admission no",
      "学号",
      "學生編號",
      "学生编号",
    ],
    required: true,
    status: "importable",
    description:
      "School Student Number → students.external_id (required for new students; portable identity).",
  },
  {
    id: "external_id",
    label: "External ID",
    aliases: [
      "external id",
      "externalid",
      "external_id",
      "ext id",
      "legacy id",
      "source id",
      "other id",
    ],
    required: false,
    status: "importable",
    description: "Alternate Student Number column; Student Number wins if both are mapped.",
  },
  {
    id: "grade",
    label: "Grade",
    aliases: [
      "grade",
      "grade level",
      "gradelevel",
      "grade_level",
      "year group",
      "yeargroup",
      "year_group",
      "form",
      "年级",
      "年級",
    ],
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
      "class_name",
      "homeroom",
      "home room",
      "home_room",
      "section",
      "class section",
      "class/section",
      "cohort",
      "form class",
      "tutor group",
      "reg class",
      "registration class",
      "班级",
      "班級",
      "班别",
      "班別",
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

/**
 * Normalize a CSV/Excel header for alias matching.
 * Keeps letters (including CJK), digits, and `#`. Collapses punctuation/spaces.
 */
export function normalizeHeaderKey(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[_./\\\-–—]+/g, " ")
    .replace(/[#]+/g, " # ")
    .replace(/[^\p{L}\p{N}#\s]+/gu, " ")
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
