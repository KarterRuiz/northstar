"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";

import type { Role } from "@/config/roles";
import { canVoidGeneratedReportCard } from "@/config/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReportCardListItem } from "@/features/report-cards/load-report-cards-for-student";
import { ReportCardDownloadButton } from "@/features/report-cards/report-card-download-button";
import { ReportCardVoidDialog } from "@/features/report-cards/report-card-void-dialog";
import { updateReportCardFileStatusAction } from "@/features/report-cards/report-card-lifecycle-actions";
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

export function ReportCardFilesList({
  items,
  listError,
  dashboardRole,
  showLifecycleControls = false,
}: {
  items: ReportCardListItem[];
  listError: string | null;
  dashboardRole: Role;
  showLifecycleControls?: boolean;
}) {
  const canVoid = canVoidGeneratedReportCard(dashboardRole);

  if (listError) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {listError}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        No report cards on file yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium tracking-tight">Report cards on file</h2>
      <ul className="divide-border border-border rounded-lg border">
        {items.map((item) => {
          const isVoided = Boolean(item.voidedAt);
          const label = `${item.title?.trim() || "Report card"} · ${item.schoolYear} · ${item.term}`;

          return (
            <li
              key={item.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    {item.title?.trim() || "Report card"}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {item.schoolYear} · {item.term}
                    </span>
                  </p>
                  <Badge
                    variant={statusBadgeVariant(item.status)}
                    className="text-xs capitalize"
                  >
                    {reportCardStatusLabel[item.status]}
                  </Badge>
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.source === "generated" ? "Generated" : "Uploaded"}
                  </Badge>
                  {isVoided ? (
                    <Badge variant="destructive" className="text-xs">
                      Voided
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {new Date(item.createdAt).toLocaleString()}
                  {item.uploadedByName
                    ? ` · ${item.uploadedByName}`
                    : item.uploadedBy
                      ? ` · ${item.uploadedBy.slice(0, 8)}…`
                      : ""}
                </p>
                {isVoided && item.voidReason ? (
                  <p className="text-muted-foreground text-xs">
                    Void reason: {item.voidReason}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <ReportCardDownloadButton fileId={item.id} label="Download" />
                {canVoid &&
                item.source === "generated" &&
                !isVoided ? (
                  <ReportCardVoidDialog
                    fileId={item.id}
                    dashboardRole={dashboardRole}
                    label={label}
                  />
                ) : null}
                {showLifecycleControls ? (
                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <form
                      action={updateReportCardFileStatusAction}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="fileId" value={item.id} />
                      <input type="hidden" name="dashboardRole" value={dashboardRole} />
                      <select
                        name="nextStatus"
                        defaultValue={item.status}
                        className="border-input bg-background h-8 max-w-[10rem] rounded-md border px-2 text-xs"
                        disabled={isVoided}
                      >
                        {REPORT_CARD_FILE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {reportCardStatusLabel[s]}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        disabled={isVoided}
                      >
                        <SubmitLabel idle="Update" />
                      </Button>
                    </form>
                    {item.status !== "archive" && !isVoided ? (
                      <form action={updateReportCardFileStatusAction}>
                        <input type="hidden" name="fileId" value={item.id} />
                        <input type="hidden" name="dashboardRole" value={dashboardRole} />
                        <input type="hidden" name="nextStatus" value="archive" />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                        >
                          <SubmitLabel idle="Archive" />
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
