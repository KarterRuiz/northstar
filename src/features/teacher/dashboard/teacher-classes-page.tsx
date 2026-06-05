import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import { loadTeacherWorkspaceData } from "@/features/teacher/dashboard/load-teacher-workspace-data";
import { TeacherClassesSkeleton } from "@/features/teacher/dashboard/teacher-classes-skeleton";

const BASE = "/dashboard/teacher";

async function TeacherClassesBody() {
  const data = await loadTeacherWorkspaceData();

  if (!data.ok) {
    return (
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <span className="font-medium">Could not load classes.</span> {data.message}
      </div>
    );
  }

  if (data.warnings.length > 0) {
    // Non-blocking — still render grid
  }

  const { classes, warnings } = data;

  return (
    <>
      {warnings.length > 0 ? (
        <div
          className="bg-muted/50 text-muted-foreground mb-4 rounded-lg border px-4 py-3 text-sm"
          role="status"
        >
          <p className="text-foreground font-medium">Partial data</p>
          <ul className="mt-2 list-inside list-disc">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {classes.length === 0 ? (
        <ListEmptyState
          title="No assigned classes"
          description="Your account is not linked in class_teachers yet. Ask leadership to assign you under Classes."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {classes.map((cls) => (
            <li key={cls.id}>
              <Card className="h-full">
                <CardHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-snug">
                      <Link
                        href={`${BASE}/classes/${cls.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {cls.name}
                      </Link>
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0 capitalize">
                      {cls.assignmentRole}
                    </Badge>
                  </div>
                  <CardDescription>
                    {cls.gradeName} · {cls.schoolYearLabel}
                    {cls.section ? ` · Section ${cls.section}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="text-foreground font-medium">{cls.studentCount}</span>{" "}
                    active students
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`${BASE}/classes/${cls.id}`}>View roster</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function TeacherClassesPageContent() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="My classes"
        description="Only classes where you appear in class_teachers. Open a class to work the roster and completion checks."
      />

      <Suspense fallback={<TeacherClassesSkeleton />}>
        <TeacherClassesBody />
      </Suspense>
    </div>
  );
}
