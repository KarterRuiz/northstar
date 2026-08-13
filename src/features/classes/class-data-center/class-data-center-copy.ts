import { formatClassTeacherRoleForDisplay } from "@/features/classes/constants";
import {
  attendancePulseLabel,
  checkInPulseLabel,
  reportCardsPulseLabel,
  studentCountLabel,
} from "@/features/teacher/class-workspace/class-workspace-copy";

export {
  attendancePulseLabel,
  checkInPulseLabel,
  reportCardsPulseLabel,
  studentCountLabel,
};

export function formatClassDataCenterMeta(args: {
  gradeName: string;
  classKindLabel: string;
  schoolYearLabel: string;
}): string {
  const grade = args.gradeName.trim() && args.gradeName !== "—" ? args.gradeName.trim() : null;
  const kind = args.classKindLabel.trim() || null;
  const year = args.schoolYearLabel.trim() || null;
  return [grade, kind, year].filter(Boolean).join(" · ");
}

export function classKindLabelFromHomeroom(hasHomeroom: boolean): string {
  return hasHomeroom ? "Homeroom" : "Class";
}

export function academicsPulseLabel(args: {
  assignmentCount: number;
  scoredCellCount: number;
}): string {
  if (args.assignmentCount <= 0) return "No grades recorded yet.";
  if (args.scoredCellCount <= 0) {
    return args.assignmentCount === 1
      ? "1 assignment · no scores yet"
      : `${args.assignmentCount} assignments · no scores yet`;
  }
  return args.assignmentCount === 1
    ? "1 assignment"
    : `${args.assignmentCount} assignments`;
}

export function formatStaffRoleInClass(dbRole: string): string {
  return formatClassTeacherRoleForDisplay(dbRole);
}

export function northStarAccountStatusLabel(args: {
  profileId: string | null;
  staffStatus: string | null;
}): string {
  if (args.profileId) return "NorthStar account active";
  const status = (args.staffStatus ?? "").trim().toLowerCase();
  if (status === "invited") return "Invitation pending";
  if (status === "draft") return "Not invited yet";
  return "No NorthStar account yet";
}
