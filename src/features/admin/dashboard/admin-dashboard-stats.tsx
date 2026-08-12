/**
 * @deprecated Prefer AdminQuickAccess + AdminSchoolPulse via loadAdminCommandCenter.
 * Kept so residual imports keep typechecking during the Home redesign.
 */
import type { Role } from "@/config/roles";

import { AdminQuickAccess } from "./admin-quick-access";
import { AdminSchoolPulse } from "./admin-school-pulse";
import { loadAdminCommandCenter } from "./load-admin-command-center";

export async function AdminDashboardStats({ role }: { role: Role }) {
  const data = await loadAdminCommandCenter(role);
  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminQuickAccess cards={data.quickAccess} />
      <AdminSchoolPulse indicators={data.pulse} error={data.error} />
    </div>
  );
}
