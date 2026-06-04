import Link from "next/link";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";

import { GradebookView } from "./gradebook-view";
import { loadGradebookPageData } from "./load-gradebook-data";

const BASE = "/dashboard/teacher";

export async function TeacherGradebookPageContent({ classId }: { classId: string }) {
  const data = await loadGradebookPageData(classId);

  if (!data.ok) {
    return (
      <div className="mx-auto w-full max-w-[100rem] space-y-6 p-4 sm:p-6 lg:p-8">
        <WorkspacePageHeader
          eyebrow={siteConfig.shortName}
          title="Gradebook"
          description="Class gradebook and score entry."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href={`${BASE}/gradebook`}>Choose class</Link>
            </Button>
          }
        />
        <div
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <span className="font-medium">Could not load gradebook.</span> {data.message}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[100rem] p-4 sm:p-6 lg:p-8">
      <GradebookView
        classId={data.classId}
        className={data.className}
        classSubtitle={data.classSubtitle}
        schoolYearLabel={data.schoolYearLabel}
        reportReadinessByStudent={data.reportReadinessByStudent}
        categories={data.categories}
        assignments={data.assignments}
        scores={data.scores}
        students={data.students}
      />
    </div>
  );
}
