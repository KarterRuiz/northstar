"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";
import {
  useWorkspaceToast,
  WorkspaceToast,
} from "@/components/workspace/workspace-toast";
import { siteConfig } from "@/config/site";
import { buildAttendanceConcern } from "@/features/attendance/attendance-concerns";
import { AttendanceTrendBadge } from "@/features/attendance/attendance-trend-badge";
import { AttendanceRiskBadge } from "@/features/attendance/attendance-risk-badge";
import { CreateInterventionSheet } from "@/features/interventions/create-intervention-sheet";
import { selectClassName } from "@/features/teacher/gradebook/gradebook-utils";

import { AdminAttendanceAnalyticsPanel } from "./admin-attendance-analytics-panel";
import type { AdminAttendanceAnalyticsData } from "./load-admin-attendance-analytics";
import type { AdminAttendancePageData } from "./load-admin-attendance-data";
import type { PositiveAttendanceSignals } from "./load-positive-attendance-signals";
import { PositiveAttendanceSignalsSection } from "./positive-attendance-signals-section";

const BASE = "/dashboard/admin/attendance";

type AdminAttendanceViewProps = Extract<AdminAttendancePageData, { ok: true }> & {
  positiveSignals: PositiveAttendanceSignals;
  analytics: Extract<AdminAttendanceAnalyticsData, { ok: true }> | null;
  analyticsError: string | null;
};

export function AdminAttendanceView(props: AdminAttendanceViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, showToast } = useWorkspaceToast();
  const [interventionTarget, setInterventionTarget] = React.useState<{
    studentId: string;
    classId: string;
    studentName: string;
    termAbsences: number;
    termTardies: number;
  } | null>(null);

  const section =
    searchParams.get("section") === "analytics" ? "analytics" : "monitoring";

  function pushFilters(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${BASE}?${params.toString()}`);
  }

  function onSectionChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "analytics") params.set("section", "analytics");
    else params.delete("section");
    router.push(`${BASE}?${params.toString()}`);
  }

  const initialForm = interventionTarget
    ? (() => {
        const concern = buildAttendanceConcern({
          termAbsences: interventionTarget.termAbsences,
          termTardies: interventionTarget.termTardies,
          weeklyAbsences: 0,
        });
        return {
          interventionType: "attendance" as const,
          severity: concern?.interventionSeverity ?? ("medium" as const),
          title: concern?.interventionTitle ?? "Attendance check-in",
          description: concern?.interventionDescription ?? "",
          status: "active" as const,
          followUpDate: null,
        };
      })()
    : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title="Attendance"
        description="Daily monitoring and school-wide attendance analytics."
      />

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Applied to monitoring and analytics below.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-date">Date</Label>
            <Input
              id="admin-date"
              type="date"
              defaultValue={props.date}
              className="w-[11rem]"
              onChange={(e) => pushFilters({ date: e.target.value })}
            />
          </div>
          <div className="min-w-[10rem] space-y-1.5">
            <Label htmlFor="admin-year">School year</Label>
            <select
              id="admin-year"
              className={selectClassName}
              defaultValue={props.schoolYearLabel}
              onChange={(e) => pushFilters({ schoolYear: e.target.value })}
            >
              {props.filterOptions.schoolYears.map((sy) => (
                <option key={sy.label} value={sy.label}>
                  {sy.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[10rem] space-y-1.5">
            <Label htmlFor="admin-grade">Grade</Label>
            <select
              id="admin-grade"
              className={selectClassName}
              defaultValue={searchParams.get("gradeId") ?? ""}
              onChange={(e) => pushFilters({ gradeId: e.target.value || null })}
            >
              <option value="">All grades</option>
              {props.filterOptions.grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[12rem] space-y-1.5">
            <Label htmlFor="admin-class">Class</Label>
            <select
              id="admin-class"
              className={selectClassName}
              defaultValue={searchParams.get("classId") ?? ""}
              onChange={(e) => pushFilters({ classId: e.target.value || null })}
            >
              <option value="">All classes</option>
              {props.filterOptions.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[10rem] space-y-1.5">
            <Label htmlFor="admin-status">Status</Label>
            <select
              id="admin-status"
              className={selectClassName}
              defaultValue={searchParams.get("status") ?? ""}
              onChange={(e) => pushFilters({ status: e.target.value || null })}
            >
              <option value="">All</option>
              <option value="missing">Not submitted today</option>
              <option value="submitted">Fully submitted</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={section} onValueChange={onSectionChange} className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <StatCard
              label="Completion today"
              value={`${props.summary.completionPct}%`}
            />
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-1">
                <CardTitle className="text-muted-foreground text-xs font-medium">
                  Attendance % (week)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <AttendanceTrendBadge trend={props.summary.attendanceTrend} />
                <p className="text-muted-foreground text-xs">vs prior week</p>
              </CardContent>
            </Card>
            <StatCard label="Absences today" value={String(props.summary.absencesToday)} />
            <StatCard label="Tardies today" value={String(props.summary.tardiesToday)} />
            <StatCard
              label="Repeated absences"
              value={String(props.summary.repeatedAbsenceStudents)}
            />
            <StatCard
              label="Classes not submitted"
              value={String(props.summary.classesNotSubmitted)}
            />
          </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today&apos;s attendance by class</CardTitle>
          <CardDescription>{props.date}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead className="text-right">Marked</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Completion</TableHead>
                <TableHead className="text-right">Absences</TableHead>
                <TableHead className="text-right">Tardies</TableHead>
                <TableHead>Week trend</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.classRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground text-sm">
                    No classes match these filters.
                  </TableCell>
                </TableRow>
              ) : (
                props.classRows.map((row) => (
                  <TableRow key={row.classId}>
                    <TableCell className="font-medium">{row.classLabel}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.teacherLabel}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.markedCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.totalStudents}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.completionPct}%</TableCell>
                    <TableCell className="text-right tabular-nums">{row.absences}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.tardies}</TableCell>
                    <TableCell>
                      <AttendanceTrendBadge trend={row.attendanceTrend} />
                    </TableCell>
                    <TableCell>
                      {!row.submitted && row.totalStudents > 0 ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          Missing submission
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Students needing attendance follow-up</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Absences (term)</TableHead>
                <TableHead className="text-right">Tardies (term)</TableHead>
                <TableHead>Last absent</TableHead>
                <TableHead>Risk tier</TableHead>
                <TableHead>Suggested action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.followUpRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground text-sm">
                    No students currently flagged for follow-up.
                  </TableCell>
                </TableRow>
              ) : (
                props.followUpRows.map((row) => (
                  <TableRow key={`${row.studentId}:${row.classId}`}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/admin/students/${row.studentId}/attendance`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {row.studentName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.classLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.termAbsences}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.termTardies}</TableCell>
                    <TableCell className="text-sm">{row.lastAbsentDate ?? "—"}</TableCell>
                    <TableCell>
                      <AttendanceRiskBadge tier={row.tier} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.suggestedAction ?? "—"}
                    </TableCell>
                    <TableCell>
                      {row.hasActiveIntervention ? (
                        <Badge variant="secondary" className="text-xs font-normal">
                          Intervention open
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Open</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.tier === "chronic_concern" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() =>
                            setInterventionTarget({
                              studentId: row.studentId,
                              classId: row.classId,
                              studentName: row.studentName,
                              termAbsences: row.termAbsences,
                              termTardies: row.termTardies,
                            })
                          }
                        >
                          Create intervention
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <PositiveAttendanceSignalsSection signals={props.positiveSignals} />
          {props.analytics ? (
            <AdminAttendanceAnalyticsPanel {...props.analytics} />
          ) : (
            <div
              className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
              role="alert"
            >
              {props.analyticsError ?? "Analytics could not be loaded."}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {interventionTarget ? (
        <CreateInterventionSheet
          open={Boolean(interventionTarget)}
          onOpenChange={(open) => {
            if (!open) setInterventionTarget(null);
          }}
          studentId={interventionTarget.studentId}
          classId={interventionTarget.classId}
          studentName={interventionTarget.studentName}
          initialForm={initialForm}
          onCreated={() => {
            showToast("success", "Attendance intervention created");
            setInterventionTarget(null);
            router.refresh();
          }}
        />
      ) : null}

      <WorkspaceToast toast={toast} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-muted-foreground text-xs font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
