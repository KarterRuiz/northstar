import { ClassWorkspaceHeader } from "./class-workspace-header";
import { ClassWorkspaceTabs } from "./class-workspace-tabs";
import type { TeacherClassContext } from "./load-teacher-class-context";

export function ClassWorkspaceShell({
  context,
  children,
}: {
  context: TeacherClassContext;
  children: React.ReactNode;
}) {
  return (
    <div className="ns-page-shell-wide space-y-6">
      <section className="bg-card border-border/80 overflow-hidden rounded-xl border shadow-sm">
        <div className="space-y-5 p-4 sm:p-6">
          <ClassWorkspaceHeader context={context} />
          <div className="border-border/70 border-t pt-4">
            <ClassWorkspaceTabs classId={context.id} />
          </div>
        </div>
      </section>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ClassWorkspaceDenied({ message }: { message: string }) {
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
