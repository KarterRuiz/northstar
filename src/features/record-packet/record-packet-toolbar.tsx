"use client";

import Link from "next/link";

import { Printer } from "lucide-react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";

export function RecordPacketToolbar({
  dashboardRole,
  studentId,
}: {
  dashboardRole: Role;
  studentId: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
      <Button type="button" variant="default" onClick={() => window.print()}>
        <Printer className="mr-2 size-4" aria-hidden />
        Print / Save PDF
      </Button>
      <Button variant="outline" asChild>
        <Link href={`/dashboard/${dashboardRole}/students/${studentId}/report-cards`}>
          Back to student profile
        </Link>
      </Button>
    </div>
  );
}
