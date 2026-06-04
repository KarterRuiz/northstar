import type { Role } from "@/config/roles";
import { roleLabels } from "@/config/roles";
import { siteConfig } from "@/config/site";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutTemplate } from "lucide-react";

import { ListEmptyState } from "@/components/workspace/list-empty-state";
import { WorkspacePageHeader } from "@/components/workspace/workspace-headers";

type SectionPlaceholderProps = {
  role: Role;
  sectionLabel: string;
  /** When set, replaces the main heading (defaults to `sectionLabel`). */
  title?: string;
  /** When set, replaces the default workspace intro paragraph. */
  description?: string;
  /** Shown inside the dashed region when `minimal` is true. */
  emptyState?: string;
  /** Lighter shell: no skeleton “layout shell” card (used for admin section stubs). */
  minimal?: boolean;
};

export function SectionPlaceholder({
  role,
  sectionLabel,
  title,
  description,
  emptyState,
  minimal = false,
}: SectionPlaceholderProps) {
  const heading = title ?? sectionLabel;

  const defaultDescription = (
    <>
      You are viewing the{" "}
      <span className="text-foreground font-medium">{roleLabels[role]}</span>{" "}
      workspace. This section is not available yet.
    </>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <WorkspacePageHeader
        eyebrow={siteConfig.shortName}
        title={heading}
        description={description ?? defaultDescription}
      />

      {minimal && emptyState ? (
        <ListEmptyState
          icon={LayoutTemplate}
          title="No content yet"
          description={emptyState}
        />
      ) : null}

      {minimal ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Section overview</CardTitle>
            <CardDescription>
              Content for this area is not available yet. Use the sidebar to
              navigate to other parts of your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Separator />
            <p className="text-muted-foreground text-sm leading-snug">
              Check back later or contact your school administrator if you
              expected to see content here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
