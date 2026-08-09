import Link from "next/link";
import { notFound } from "next/navigation";
import { Sprout } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isRole } from "@/config/roles";
import { GradesTab } from "@/features/students/profile/tabs/grades-tab";
import { isStudentId } from "@/lib/students/uuid";

type PageProps = {
  params: Promise<{ role: string; studentId: string }>;
};

export default async function StudentAcademicsPage({ params }: PageProps) {
  const { role: roleParam, studentId } = await params;
  if (!isRole(roleParam)) notFound();
  if (!isStudentId(studentId)) notFound();

  const base = `/dashboard/${roleParam}/students/${studentId}`;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Academics</h2>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Running gradebook picture plus structured academic records for this learner.
        </p>
      </div>
      <GradesTab studentId={studentId} role={roleParam} />
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Development &amp; growth</CardTitle>
            <CardDescription>
              Longitudinal growth goals will surface here when connected. The legacy route
              remains for bookmarks.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={`${base}/growth`}>
              <Sprout className="size-4" aria-hidden />
              Open growth workspace
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs leading-relaxed">
          Tip: keep deep links to{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-[11px]">/growth</code> — they
          continue to work alongside this hub.
        </CardContent>
      </Card>
    </div>
  );
}
