"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";

import type { Role } from "@/config/roles";
import { canVoidGeneratedReportCard } from "@/config/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportCardDownloadButton } from "@/features/report-cards/report-card-download-button";
import { ReportCardVoidDialog } from "@/features/report-cards/report-card-void-dialog";
import { updateReportCardFileStatusAction } from "@/features/report-cards/report-card-lifecycle-actions";
import type { ReportCardRegistryRow } from "@/features/report-cards/load-report-cards-registry";
import {
  REPORT_CARD_FILE_STATUSES,
  reportCardStatusLabel,
} from "@/lib/report-cards/status";
import type { ReportCardFileStatus } from "@/lib/report-cards/status";

function SubmitLabel({ idle }: { idle: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? "Saving…" : idle}</>;
}

function statusBadgeVariant(
  status: ReportCardFileStatus,
): ComponentProps<typeof Badge>["variant"] {
  if (status === "draft") return "secondary";
  if (status === "final") return "default";
  return "outline";
}

type ReportCardRegistryTableProps = {
  rows: ReportCardRegistryRow[];
  dashboardRole: Role;
};

export function ReportCardRegistryTable({
  rows,
  dashboardRole,
}: ReportCardRegistryTableProps) {
  const canVoid = canVoidGeneratedReportCard(dashboardRole);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm" role="status">
        No report cards match these filters.
      </p>
    );
  }

  const th =
    "text-muted-foreground whitespace-nowrap text-xs font-semibold uppercase tracking-wide";

  return (
    <div className="border-border overflow-x-auto rounded-xl border shadow-sm">
      <Table aria-label="Report card registry">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={th}>Student</TableHead>
            <TableHead className={th}>Year / term</TableHead>
            <TableHead className={`${th} hidden lg:table-cell`}>Title</TableHead>
            <TableHead className={th}>Status</TableHead>
            <TableHead className={`${th} hidden sm:table-cell`}>Source</TableHead>
            <TableHead className={`${th} hidden md:table-cell`}>Record</TableHead>
            <TableHead className={`${th} hidden lg:table-cell`}>Created</TableHead>
            <TableHead className={`${th} text-right`}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isVoided = Boolean(row.voidedAt);
            const label = `${row.title?.trim() || "Report card"} · ${row.schoolYear} · ${row.term}`;

            return (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <Link
                    className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                    href={`/dashboard/${dashboardRole}/students/${row.studentId}/report-cards`}
                  >
                    {row.studentName}
                  </Link>
                  {row.studentNumber ? (
                    <span className="text-muted-foreground text-xs">
                      #{row.studentNumber}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5 text-sm">
                  <span className="font-medium">{row.schoolYear}</span>
                  <span className="text-muted-foreground text-xs">{row.term}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground hidden max-w-xs truncate text-sm lg:table-cell">
                {row.title?.trim() || "—"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={statusBadgeVariant(row.status)}
                  className="capitalize"
                >
                  {reportCardStatusLabel[row.status]}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-xs capitalize sm:table-cell">
                {row.source}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant={isVoided ? "destructive" : "secondary"} className="text-xs">
                  {isVoided ? "Voided" : "Active"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                <div className="flex flex-col gap-0.5">
                  <span>{row.createdAt.slice(0, 10)}</span>
                  {row.uploadedByName ? (
                    <span className="text-xs">{row.uploadedByName}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end gap-2">
                  <ReportCardDownloadButton fileId={row.id} label="View" />
                  {canVoid && row.source === "generated" && !isVoided ? (
                    <ReportCardVoidDialog
                      fileId={row.id}
                      dashboardRole={dashboardRole}
                      label={label}
                    />
                  ) : null}
                  <form action={updateReportCardFileStatusAction}>
                    <input type="hidden" name="fileId" value={row.id} />
                    <input type="hidden" name="dashboardRole" value={dashboardRole} />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <select
                        name="nextStatus"
                        defaultValue={row.status}
                        disabled={isVoided}
                        className="border-input bg-background ring-offset-background focus-visible:ring-ring h-8 max-w-[9rem] rounded-md border px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      >
                        {REPORT_CARD_FILE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {reportCardStatusLabel[s]}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="secondary">
                        <SubmitLabel idle="Apply" />
                      </Button>
                    </div>
                  </form>
                  {row.status !== "archive" && !isVoided ? (
                    <form action={updateReportCardFileStatusAction}>
                      <input type="hidden" name="fileId" value={row.id} />
                      <input type="hidden" name="dashboardRole" value={dashboardRole} />
                      <input type="hidden" name="nextStatus" value="archive" />
                      <Button type="submit" size="sm" variant="outline">
                        <SubmitLabel idle="Archive" />
                      </Button>
                    </form>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
