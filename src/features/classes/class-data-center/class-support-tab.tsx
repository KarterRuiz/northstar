import { ClassSupportList } from "@/features/teacher/class-workspace/class-support-list";

import { loadClassDataCenterSupport } from "./load-class-data-center-support";

export async function ClassDataCenterSupportTab({ classId }: { classId: string }) {
  const data = await loadClassDataCenterSupport(classId);

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
