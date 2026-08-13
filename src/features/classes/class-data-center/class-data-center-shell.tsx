import { ClassDataCenterHeader } from "./class-data-center-header";
import { ClassDataCenterTabs } from "./class-data-center-tabs";
import type { ClassDataCenterContext } from "./load-class-data-center-context";
import type { ClassDataCenterManagementOptions } from "./load-class-data-center-management-options";
import { ClassDataCenterActions } from "./class-data-center-actions";

export function ClassDataCenterShell({
  context,
  management,
  children,
}: {
  context: ClassDataCenterContext;
  management: ClassDataCenterManagementOptions;
  children: React.ReactNode;
}) {
  return (
    <div className="ns-page-shell-wide space-y-6">
      <section className="bg-card border-border/80 overflow-hidden rounded-xl border shadow-sm">
        <div className="space-y-5 p-4 sm:p-6">
          <div className="space-y-3">
            <ClassDataCenterHeader
              context={context}
              actions={
                <ClassDataCenterActions
                  context={context}
                  teachers={management.teachers}
                  schoolYears={management.schoolYears}
                  gradeLevels={management.gradeLevels}
                />
              }
            />
          </div>
          <div className="border-border/70 border-t pt-4">
            <ClassDataCenterTabs role={context.role} classId={context.id} />
          </div>
        </div>
      </section>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ClassDataCenterDenied({ message }: { message: string }) {
  return (
    <div className="ns-page-shell space-y-4">
      <div
        className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        role="alert"
      >
        <p className="font-medium">Could not open this class.</p>
        <p className="mt-1 opacity-90">{message}</p>
      </div>
    </div>
  );
}
