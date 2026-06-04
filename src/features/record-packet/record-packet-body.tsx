import Link from "next/link";

import type { Role } from "@/config/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListEmptyState } from "@/components/workspace/list-empty-state";

import type { RecordPacketPayload } from "./load-record-packet-data";

type PacketOk = Extract<RecordPacketPayload, { ok: true }>;

export function RecordPacketBody({
  dashboardRole,
  studentId,
  data,
}: {
  dashboardRole: Role;
  studentId: string;
  data: PacketOk;
}) {
  const profile = data.profile;

  return (
    <article className="record-packet-print-root space-y-8">
      <header className="border-border space-y-2 border-b pb-6">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
          Official student record packet
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{profile.fullName}</h1>
        <dl className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium tracking-wide uppercase">Student number</dt>
            <dd className="text-foreground">{profile.studentNumber}</dd>
          </div>
          <div>
            <dt className="font-medium tracking-wide uppercase">Grade &amp; class</dt>
            <dd className="text-foreground">
              {profile.gradeLevel}
              <span className="text-muted-foreground"> · </span>
              {profile.homeroom}
            </dd>
          </div>
          <div>
            <dt className="font-medium tracking-wide uppercase">Division</dt>
            <dd className="text-foreground capitalize">{profile.division}</dd>
          </div>
          <div>
            <dt className="font-medium tracking-wide uppercase">Enrollment status</dt>
            <dd className="text-foreground capitalize">{profile.status}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium tracking-wide uppercase">Record id</dt>
            <dd>
              <code className="text-foreground bg-muted/70 rounded px-2 py-1 font-mono text-xs break-all">
                {studentId}
              </code>
            </dd>
          </div>
        </dl>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Enrollment history</h2>
        {data.enrollments.length === 0 ? (
          <ListEmptyState
            title="No enrollment rows"
            description="No historical enrollment rows were returned for this student."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School year</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recorded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.enrollments.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.schoolYearLabel}</TableCell>
                  <TableCell>{e.classLabel}</TableCell>
                  <TableCell>{e.gradeLevel}</TableCell>
                  <TableCell className="capitalize">{e.status}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {e.createdAt.slice(0, 10)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Report card files</h2>
        {data.reportCardsError ? (
          <p className="text-destructive text-sm">{data.reportCardsError}</p>
        ) : data.reportCards.length === 0 ? (
          <ListEmptyState
            title="No report card files"
            description="No PDF metadata rows exist for this student."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[9rem]">Storage path</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.reportCards.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{f.schoolYear}</TableCell>
                  <TableCell>{f.term}</TableCell>
                  <TableCell>{f.title?.trim() || "—"}</TableCell>
                  <TableCell className="capitalize">{f.status}</TableCell>
                  <TableCell className="font-mono text-xs break-all text-muted-foreground">
                    {f.storagePath}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Transition insights (summaries)
        </h2>
        <p className="text-muted-foreground mb-4 max-w-3xl text-sm leading-relaxed">
          Latest non-draft notes only; text is truncated for packet brevity. Full narratives remain
          on the student profile transition tab.
        </p>
        {data.transitionNotes.length === 0 ? (
          <ListEmptyState
            title="No published transition notes"
            description="Draft notes are omitted from this packet."
          />
        ) : (
          <div className="space-y-3">
            {data.transitionNotes.map((n) => (
              <Card key={n.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Note · {n.updatedAt.slice(0, 10)}{" "}
                    <span className="text-muted-foreground font-normal capitalize">
                      ({n.status})
                    </span>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">{n.id}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed">{n.summary}</CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Parent / guardian record requests
        </h2>
        {data.parentRequests.length === 0 ? (
          <ListEmptyState
            title="No logged requests"
            description="Parent record requests for this student will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submitted</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.parentRequests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {r.createdAt.slice(0, 10)}
                  </TableCell>
                  <TableCell>{r.requesterName}</TableCell>
                  <TableCell>{r.statusLabel}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/${dashboardRole}/parent-requests/${r.id}`}
                      className="text-primary text-sm font-medium underline-offset-4 hover:underline print:hidden"
                    >
                      View
                    </Link>
                    <span className="text-muted-foreground hidden print:inline text-xs">
                      Request {r.id.slice(0, 8)}…
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </article>
  );
}
