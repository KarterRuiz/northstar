import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isRole } from "@/config/roles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AcademicRecordForm } from "@/features/teacher/academic-records/academic-record-form";
import { loadAcademicRecordForForm } from "@/features/teacher/academic-records/actions";
import { isStudentId, isUuid } from "@/lib/students/uuid";

export const metadata: Metadata = {
  title: "Academic record",
  description: "Structured grades and comments for a student in your class.",
};

type PageProps = {
  params: Promise<{ role: string }>;
  searchParams: Promise<{
    studentId?: string;
    classId?: string;
    recordId?: string;
  }>;
};

export default async function NewAcademicRecordPage({ params, searchParams }: PageProps) {
  const { role } = await params;
  if (!isRole(role) || role !== "teacher") notFound();

  const sp = await searchParams;
  const studentId =
    typeof sp.studentId === "string" && isStudentId(sp.studentId)
      ? sp.studentId
      : undefined;
  const classId =
    typeof sp.classId === "string" && isUuid(sp.classId) ? sp.classId : undefined;
  const recordId =
    typeof sp.recordId === "string" && isUuid(sp.recordId) ? sp.recordId : undefined;

  const backHref =
    classId && studentId
      ? `/dashboard/teacher/classes/${classId}`
      : "/dashboard/teacher/classes";

  return (
    <AcademicRecordPageBody
      studentId={studentId}
      classId={classId}
      recordId={recordId}
      backHref={backHref}
    />
  );
}

async function AcademicRecordPageBody({
  studentId,
  classId,
  recordId,
  backHref,
}: {
  studentId?: string;
  classId?: string;
  recordId?: string;
  backHref: string;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6 sm:p-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Teacher workspace
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Academic record
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-base">
              Enter subject outcomes, term, score, and comments. Submit when ready for
              leadership review. Official PDF report cards are uploaded separately.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>Back to class</Link>
          </Button>
        </div>
      </div>

      {!studentId || !classId ? (
        <Card>
          <CardHeader>
            <CardTitle>Missing context</CardTitle>
            <CardDescription>
              Open a class from My classes and use the roster, or add a class on the compose
              URL when you know the class id.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/teacher/students">Students</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/teacher/classes">My classes</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ComposeSection
          studentId={studentId}
          classId={classId}
          recordId={recordId}
          backHref={backHref}
        />
      )}
    </div>
  );
}

async function ComposeSection({
  studentId,
  classId,
  recordId,
  backHref,
}: {
  studentId: string;
  classId: string;
  recordId?: string;
  backHref: string;
}) {
  const loaded = await loadAcademicRecordForForm({ studentId, classId, recordId });
  if (!loaded.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not open form</CardTitle>
          <CardDescription>{loaded.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>Back to class</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <AcademicRecordForm
      studentId={studentId}
      classId={classId}
      initialRecordId={loaded.recordId}
      initialValues={loaded.fields}
      editable={loaded.editable}
      lockedStatus={loaded.editable ? undefined : loaded.status}
      backHref={backHref}
    />
  );
}
