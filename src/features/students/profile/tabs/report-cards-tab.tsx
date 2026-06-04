import { FileText } from "lucide-react";

import type { Role } from "@/config/roles";
import { canManageReportCardLifecycle } from "@/config/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportCardFilesList } from "@/features/report-cards/report-card-files-list";

import { ProfileEmptyState } from "../profile-empty-state";
import { loadReportCardFileRows } from "../supabase-profile-data";

const CARD_CHROME = "border-border/70 shadow-sm";

type ReportCardsTabProps = {
  studentId: string;
  dashboardRole: Role;
};

export async function ReportCardsTab({
  studentId,
  dashboardRole,
}: ReportCardsTabProps) {
  const { items, error: listError } = await loadReportCardFileRows(studentId);
  const showLifecycle = canManageReportCardLifecycle(dashboardRole);

  return (
    <Card className={CARD_CHROME}>
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-base">Report card files</CardTitle>
        <CardDescription>
          PDFs stored in the private <code className="text-foreground text-xs">report-cards</code>{" "}
          bucket. Generated snapshots and uploaded PDFs are listed with source and record status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && !listError ? (
          <ProfileEmptyState
            icon={FileText}
            title="No report cards on file"
            description={
              <>
                Report cards generated from the teacher workspace or uploaded as PDFs appear here
                with year, term, and status.
              </>
            }
          />
        ) : null}
        <ReportCardFilesList
          items={items}
          listError={listError}
          dashboardRole={dashboardRole}
          showLifecycleControls={showLifecycle}
        />
      </CardContent>
    </Card>
  );
}
