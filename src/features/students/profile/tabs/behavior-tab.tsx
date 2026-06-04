import Link from "next/link";
import { Heart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Role } from "@/config/roles";
import {
  loadStudentBehaviorProfile,
  type StudentBehaviorRecord,
} from "@/features/attendance-behavior/load-student-behavior-profile";
import {
  buildGrowthStory,
  buildGrowthStoryPreviewText,
} from "@/lib/student-support/growth-story";
import {
  behaviorTypeLabels,
  behaviorTypeToSupportCategory,
  supportLevelLabels,
} from "@/features/behavior/schema";
import { quickReasonLabel, supportMomentCategoryLabels } from "@/lib/student-support/quick-reasons";
import { cn } from "@/lib/utils";

import { ProfileEmptyState } from "../profile-empty-state";

const CARD_CHROME = "border-border/70 shadow-sm";

type BehaviorTabProps = {
  studentId: string;
  role: Role;
};

function supportLevelClassName(severity: StudentBehaviorRecord["severity"]): string {
  if (severity === "positive") {
    return "border-sky-400/45 bg-sky-500/10 text-sky-950 dark:text-sky-100";
  }
  if (severity === "high") {
    return "border-amber-600/40 bg-amber-500/12 text-amber-950 dark:text-amber-50";
  }
  if (severity === "medium") {
    return "border-amber-400/45 bg-amber-400/10 text-amber-950 dark:text-amber-50";
  }
  return "border-slate-400/35 bg-slate-500/10 text-slate-800 dark:text-slate-100";
}

function momentLabel(row: StudentBehaviorRecord): string {
  if (row.supportCategory) return supportMomentCategoryLabels[row.supportCategory];
  return behaviorTypeLabels[row.behaviorType];
}

function reasonLine(row: StudentBehaviorRecord): string | null {
  if (!row.quickReason?.trim()) return null;
  const cat =
    row.supportCategory ?? behaviorTypeToSupportCategory(row.behaviorType) ?? "quick_concern";
  return quickReasonLabel(cat, row.quickReason.trim());
}

function ProfileBehaviorItem({ row }: { row: StudentBehaviorRecord }) {
  const body = row.generatedSummary?.trim() || row.title;
  const reason = reasonLine(row);
  return (
    <li className="border-border/60 rounded-xl border bg-card/30 px-4 py-3">
      <ProfileBehaviorItemHeader row={row} />
      <p className="text-foreground mt-2 text-sm leading-relaxed">{body}</p>
      {reason ? (
        <p className="text-muted-foreground mt-1.5 text-xs">
          Quick tag: <span className="text-foreground/85 font-medium">{reason}</span>
        </p>
      ) : null}
      {row.teacherNote?.trim() && row.teacherNote.trim() !== body ? (
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          <span className="text-foreground/80 font-medium">Teacher note: </span>
          {row.teacherNote}
        </p>
      ) : null}
      {row.description?.trim() && !row.teacherNote?.trim() && row.description.trim() !== body ? (
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{row.description}</p>
      ) : null}
      {row.actionTaken?.trim() ? (
        <p className="text-muted-foreground mt-2 text-xs">
          <span className="text-foreground/80 font-medium">Support offered: </span>
          {row.actionTaken}
        </p>
      ) : null}
      {row.followUpRequired ? (
        <p className="text-muted-foreground mt-2 text-xs font-medium">Follow-up requested</p>
      ) : null}
    </li>
  );
}

function ProfileBehaviorItemHeader({ row }: { row: StudentBehaviorRecord }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-muted-foreground text-xs tabular-nums">{row.behaviorDate}</p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-xs font-normal">
          {momentLabel(row)}
        </Badge>
        <Badge
          variant="outline"
          className={cn("text-xs font-normal", supportLevelClassName(row.severity))}
        >
          {supportLevelLabels[row.severity]}
        </Badge>
      </div>
    </div>
  );
}

export async function BehaviorTab({ studentId, role }: BehaviorTabProps) {
  const data = await loadStudentBehaviorProfile(studentId, role);

  if (!data.ok) {
    return (
      <Card className={CARD_CHROME}>
        <CardContent className="pt-6">
          <ProfileEmptyState
            icon={Heart}
            title="Student support unavailable"
            description={data.message}
          />
        </CardContent>
      </Card>
    );
  }

  const growthStory = buildGrowthStory(data.growthStoryRecords);
  const growthStoryPreview = buildGrowthStoryPreviewText(growthStory);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Strengths noted</CardTitle>
            <CardDescription>Positive recognition this school year.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{data.positiveCount}</p>
          </CardContent>
        </Card>
        <Card className={CARD_CHROME}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Follow-up flagged</CardTitle>
            <CardDescription>
              Quick concerns marked for follow-up soon or priority support.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{data.concernCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className={CARD_CHROME}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Growth story</CardTitle>
          <CardDescription>
            Longitudinal summary from logged support moments (deterministic; no external AI).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-foreground/90 text-sm leading-relaxed">{growthStoryPreview}</p>
        </CardContent>
      </Card>

      {data.recent.length > 0 ? (
        <Card className={CARD_CHROME}>
          <CardHeader>
            <CardTitle className="text-base">Support timeline</CardTitle>
            <CardDescription>
              Support moments teachers log from the Student Support workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.recent.map((row) => (
                <ProfileBehaviorItem key={row.id} row={row} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card className={CARD_CHROME}>
          <CardContent className="pt-6">
            <ProfileEmptyState
              icon={Heart}
              title="No support moments yet"
              description="When teachers log recognition, check-ins, or strategies, they will show up here."
            />
          </CardContent>
        </Card>
      )}

      {role === "teacher" ? (
        <Link
          href={`/dashboard/teacher/behavior?studentId=${studentId}`}
          className="text-primary text-xs font-medium underline-offset-4 hover:underline"
        >
          Open support board
        </Link>
      ) : null}
    </div>
  );
}
