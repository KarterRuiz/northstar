import { ClassAttendanceSession } from "./class-attendance-session";
import { loadTeacherClassAttendance } from "./load-teacher-class-attendance";

export async function ClassAttendanceTab({
  classId,
  attendanceDate,
}: {
  classId: string;
  attendanceDate: string | null;
}) {
  const data = await loadTeacherClassAttendance(classId, attendanceDate);

  if (!data.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not load attendance.</span> {data.message}
      </div>
    );
  }

  return (
    <ClassAttendanceSession
      classId={data.classId}
      schoolYearLabel={data.schoolYearLabel}
      attendanceDate={data.attendanceDate}
      studentCountLabel={data.studentCountLabel}
      completionLabel={data.completionLabel}
      roster={data.roster}
      history={data.history}
    />
  );
}
