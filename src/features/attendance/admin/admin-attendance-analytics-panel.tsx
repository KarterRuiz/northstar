"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  AttendanceStickyTable,
  attendanceStickyHeadClassName,
} from "@/features/attendance/attendance-sticky-table";
import { ATTENDANCE_TABLE_STICKY } from "@/features/attendance/attendance-table-sticky";
import { AttendanceTrendBadge } from "@/features/attendance/attendance-trend-badge";
import { selectClassName } from "@/features/teacher/gradebook/gradebook-utils";
import { cn } from "@/lib/utils";

import {
  formatHeatmapCellLabel,
  heatmapCellSurfaceClass,
} from "./admin-attendance-heatmap-utils";
import type { AdminAttendanceAnalyticsData } from "./load-admin-attendance-analytics";

const BASE = "/dashboard/admin/attendance";

type AnalyticsPanelProps = Extract<AdminAttendanceAnalyticsData, { ok: true }>;

export function AdminAttendanceAnalyticsPanel(props: AnalyticsPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const heatmapRows = props.weeklyHeatmap.rowMode;

  function pushHeatmapRows(mode: "class" | "grade") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", "analytics");
    if (mode === "grade") params.set("heatmapRows", "grade");
    else params.delete("heatmapRows");
    router.push(`${BASE}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Grade-level attendance summary</CardTitle>
          <CardDescription>Term totals and month-over-month attendance trend.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Attendance %</TableHead>
                <TableHead className="text-right">Absences</TableHead>
                <TableHead className="text-right">Tardies</TableHead>
                <TableHead className="text-right">Students at risk</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.gradeSummaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-sm">
                    No grades match these filters. Try clearing the grade filter or choosing a
                    different school year.
                  </TableCell>
                </TableRow>
              ) : (
                props.gradeSummaries.map((row) => (
                  <TableRow key={row.gradeId}>
                    <TableCell className="font-medium">{row.gradeName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.attendancePct != null ? (
                        <span className="inline-flex flex-col items-end gap-0.5">
                          <span>{row.attendancePct}%</span>
                          {row.partialNote ? (
                            <span className="text-muted-foreground text-[11px] font-normal leading-tight">
                              {row.partialNote}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">No marked days in range</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.absences}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.tardies}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.studentsAtRisk}</TableCell>
                    <TableCell>
                      <AttendanceTrendBadge trend={row.trend} />
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
          <CardTitle className="text-base">Class-level attendance comparison</CardTitle>
          <CardDescription>Term attendance by class with weekly trend.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead className="text-right">Attendance %</TableHead>
                <TableHead className="text-right">Absences</TableHead>
                <TableHead className="text-right">Tardies</TableHead>
                <TableHead>Today</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.classComparisons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-sm">
                    No classes match these filters. Try clearing the class or grade filter, or
                    confirm attendance is recorded for the selected school year.
                  </TableCell>
                </TableRow>
              ) : (
                props.classComparisons.map((row) => (
                  <TableRow key={row.classId}>
                    <TableCell className="font-medium">{row.classLabel}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.teacherLabel}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.attendancePct != null ? (
                        <span className="inline-flex flex-col items-end gap-0.5">
                          <span>{row.attendancePct}%</span>
                          {row.partialNote ? (
                            <span className="text-muted-foreground text-[11px] font-normal leading-tight">
                              {row.partialNote}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">No marked days in range</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.absences}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.tardies}</TableCell>
                    <TableCell>
                      {row.notSubmittedToday ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          Not submitted
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Submitted</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AttendanceTrendBadge trend={row.trend} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Attendance heatmaps</p>
          <p className="text-muted-foreground text-xs">
            Colored cells show attendance % for days or weeks with marks; — means no records that
            period.
          </p>
        </div>
        <div className="min-w-[10rem] space-y-1.5">
          <Label htmlFor="heatmap-rows">Heatmap rows</Label>
          <select
            id="heatmap-rows"
            className={selectClassName}
            value={heatmapRows}
            onChange={(e) => pushHeatmapRows(e.target.value as "class" | "grade")}
          >
            <option value="class">By class</option>
            <option value="grade">By grade</option>
          </select>
        </div>
      </div>

      <Tabs defaultValue="weekly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
        <TabsContent value="weekly">
          <HeatmapCard
            title="Weekly attendance heatmap"
            description="School days in the selected week (Mon–Fri)."
            section={props.weeklyHeatmap}
          />
        </TabsContent>
        <TabsContent value="monthly">
          <HeatmapCard
            title="Monthly attendance heatmap"
            description="Attendance by week within the selected month."
            section={props.monthlyHeatmap}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeatmapCard({
  title,
  description,
  section,
}: {
  title: string;
  description: string;
  section: AnalyticsPanelProps["weeklyHeatmap"];
}) {
  const rowHeadClass = cn(
    attendanceStickyHeadClassName(),
    ATTENDANCE_TABLE_STICKY.studentHead,
    ATTENDANCE_TABLE_STICKY.edgeLeft,
  );
  const rowCellClass = cn(
    "font-medium",
    ATTENDANCE_TABLE_STICKY.studentCell,
    ATTENDANCE_TABLE_STICKY.edgeLeft,
  );

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pb-1">
        {section.rows.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">
            No {section.rowMode === "grade" ? "grades" : "classes"} match these filters. Heatmaps
            need at least one row with attendance marks in the selected week or month.
          </p>
        ) : (
          <AttendanceStickyTable
            ariaLabel={title}
            minWidth={`${10 + section.columns.length * 4}rem`}
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={rowHeadClass}>
                    {section.rowMode === "grade" ? "Grade" : "Class"}
                  </TableHead>
                  {section.columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(attendanceStickyHeadClassName(), "text-center")}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row) => (
                  <TableRow key={row.id} className="group">
                    <TableCell className={rowCellClass}>{row.label}</TableCell>
                    {row.cells.map((cell) => (
                      <TableCell
                        key={cell.key}
                        className={cn(
                          "p-1 text-center text-xs tabular-nums",
                          heatmapCellSurfaceClass(cell.pct),
                        )}
                      >
                        <span className="sr-only">
                          {formatHeatmapCellLabel(cell.pct)} attendance
                        </span>
                        <span aria-hidden>{cell.label}</span>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AttendanceStickyTable>
        )}
      </CardContent>
    </Card>
  );
}
