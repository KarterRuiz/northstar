import type { Role } from "@/config/roles";

import {
  classRosterEnrollmentVisible,
  classRosterFiltersUseful,
} from "./class-roster";
import { ClassRosterTable } from "./class-roster-table";
import { loadTeacherClassRoster } from "./load-teacher-class-roster";

export async function ClassStudentsTab({
  classId,
  role,
}: {
  classId: string;
  role: Role;
}) {
  const data = await loadTeacherClassRoster(classId);

  if (!data.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not load the class roster.</span> {data.message}
      </div>
    );
  }

  const enrollment = classRosterEnrollmentVisible(role)
    ? {
        addHref: `/dashboard/${role}/classes/${classId}/students/new`,
        bulkHref: `/dashboard/${role}/classes/${classId}/students/bulk`,
      }
    : null;

  return (
    <ClassRosterTable
      students={data.students}
      showStudentNumber={data.showStudentNumber}
      showFilters={classRosterFiltersUseful(data.students)}
      enrollment={enrollment}
    />
  );
}
