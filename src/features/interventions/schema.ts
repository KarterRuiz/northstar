export const interventionTypes = [
  "academic_support",
  "missing_work",
  "attendance",
  "behavior",
  "enrichment",
  "parent_contact",
  "reteach",
  "SEL_support",
] as const;

export type InterventionType = (typeof interventionTypes)[number];

export const interventionStatuses = [
  "active",
  "monitoring",
  "resolved",
  "escalated",
] as const;

export type InterventionStatus = (typeof interventionStatuses)[number];

export const interventionSeverities = ["low", "medium", "high"] as const;

export type InterventionSeverity = (typeof interventionSeverities)[number];

export const interventionTypeLabels: Record<InterventionType, string> = {
  academic_support: "Academic support",
  missing_work: "Missing work",
  attendance: "Attendance",
  behavior: "Classroom support",
  enrichment: "Enrichment",
  parent_contact: "Parent contact",
  reteach: "Reteach",
  SEL_support: "SEL support",
};

export const interventionStatusLabels: Record<InterventionStatus, string> = {
  active: "Active",
  monitoring: "Monitoring",
  resolved: "Resolved",
  escalated: "Escalated",
};

export const interventionSeverityLabels: Record<InterventionSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export type InterventionPreset = {
  id: string;
  label: string;
  interventionType: InterventionType;
  severity: InterventionSeverity;
  title: string;
  description: string;
};

export const interventionQuickPresets: InterventionPreset[] = [
  {
    id: "missing",
    label: "Missing assignments",
    interventionType: "missing_work",
    severity: "medium",
    title: "Missing assignments follow-up",
    description: "Student has outstanding work; plan check-in and completion support.",
  },
  {
    id: "academic",
    label: "Academic concern",
    interventionType: "academic_support",
    severity: "high",
    title: "Academic concern",
    description: "Running grade below target; review strengths and gaps with the learner.",
  },
  {
    id: "parent",
    label: "Parent communication",
    interventionType: "parent_contact",
    severity: "medium",
    title: "Parent communication",
    description: "Contact family to share progress and agree on next steps.",
  },
  {
    id: "reteach",
    label: "Small group reteach",
    interventionType: "reteach",
    severity: "medium",
    title: "Small group reteach",
    description: "Targeted reteach session for key standards or skills.",
  },
  {
    id: "enrichment",
    label: "Enrichment extension",
    interventionType: "enrichment",
    severity: "low",
    title: "Enrichment extension",
    description: "Extension project or challenge for a high-performing learner.",
  },
  {
    id: "attendance",
    label: "Attendance concern",
    interventionType: "attendance",
    severity: "medium",
    title: "Attendance check-in",
    description: "Review attendance pattern and plan family check-in or monitoring.",
  },
];

export type CreateInterventionInput = {
  studentId: string;
  classId: string;
  interventionType: InterventionType;
  severity: InterventionSeverity;
  title: string;
  description: string;
  status: InterventionStatus;
  followUpDate: string | null;
};
