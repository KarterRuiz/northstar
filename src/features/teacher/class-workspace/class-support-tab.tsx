import { ClassSupportList } from "./class-support-list";
import { loadTeacherClassSupport } from "./load-teacher-class-support";

export async function ClassSupportTab({ classId }: { classId: string }) {
  const data = await loadTeacherClassSupport(classId);

  if (!data.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not load support signals.</span> {data.message}
      </div>
    );
  }

  return (
    <ClassSupportList
      students={data.students}
      positiveNoteCount={data.positiveNoteCount}
    />
  );
}
