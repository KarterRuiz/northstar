import { Suspense } from "react";

import { canManageClassEnrollment } from "@/config/roles";

import { ClassDataCenterStudentsTable } from "./class-students-tab";
import { loadClassDataCenterStudents } from "./load-class-data-center-students";

export async function ClassDataCenterStudentsTab({ classId }: { classId: string }) {
  const data = await loadClassDataCenterStudents(classId);

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

  return (
    <Suspense fallback={null}>
      <ClassDataCenterStudentsTable
        role={data.role}
        classId={data.classId}
        classTitle={data.classTitle}
        schoolYearLabel={data.schoolYearLabel}
        students={data.students}
        showStudentNumber={data.showStudentNumber}
        canManageRoster={canManageClassEnrollment(data.role)}
      />
    </Suspense>
  );
}
