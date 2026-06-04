import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canModerateTransitionNotes, type Role } from "@/config/roles";

import { ProfileEmptyState } from "../profile-empty-state";
import {
  loadTransitionNotes,
  teacherCanAccessStudentForProfile,
} from "../supabase-profile-data";
import { TransitionNoteModerationBar } from "../transition-note-moderation-bar";
import type { TransitionNote, TransitionNoteStatus } from "../types";

const CARD_CHROME = "border-border/70 shadow-sm";

type TransitionNotesTabProps = {
  studentId: string;
  viewerRole: Role;
};

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}

function statusVariant(
  status: TransitionNoteStatus,
): "default" | "secondary" | "outline" {
  if (status === "reviewed") return "default";
  if (status === "submitted" || status === "reopened") return "secondary";
  if (status === "archived") return "outline";
  return "outline";
}

export async function TransitionNotesTab({
  studentId,
  viewerRole,
}: TransitionNotesTabProps) {
  const loaded = await loadTransitionNotes(studentId);
  const canCompose =
    viewerRole === "teacher" &&
    (await teacherCanAccessStudentForProfile(studentId));
  const teacherComposeHref = `/dashboard/teacher/transition-notes/new?studentId=${encodeURIComponent(studentId)}`;

  if (loaded.kind === "error") {
    return (
      <Card className={CARD_CHROME}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Transition notes</CardTitle>
          <CardDescription>Notes could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm" role="alert">
            {loaded.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const notes = loaded.notes;
  const showModeration = canModerateTransitionNotes(viewerRole);

  return (
    <div className="grid gap-5">
      {canCompose ? (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="secondary">
            <Link href={teacherComposeHref}>New transition note</Link>
          </Button>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <Card className={CARD_CHROME}>
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-base">Transition notes</CardTitle>
            <CardDescription>Continuity between teams and programs.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileEmptyState
              icon={ClipboardList}
              title="No transition notes yet"
              description={
                canCompose ? (
                  <>
                    Handoff notes for this learner will appear here once you or
                    colleagues submit them.{" "}
                    <Link
                      href={teacherComposeHref}
                      className="text-primary font-medium underline-offset-4 hover:underline"
                    >
                      Create transition note
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Handoff notes for this learner will appear here from Supabase{" "}
                    <code className="text-foreground text-xs">transition_notes</code>
                    .
                  </>
                )
              }
            />
          </CardContent>
        </Card>
      ) : (
        notes.map((note) => (
          <TransitionNoteCard
            key={note.id}
            note={note}
            studentId={studentId}
            showModeration={showModeration}
          />
        ))
      )}
    </div>
  );
}

function TransitionNoteCard({
  note,
  studentId,
  showModeration,
}: {
  note: TransitionNote;
  studentId: string;
  showModeration: boolean;
}) {
  return (
    <Card
      className={`${CARD_CHROME} transition-shadow hover:shadow-md`}
    >
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-lg leading-snug">{note.title}</CardTitle>
          <CardDescription className="space-y-0.5">
            <span className="block">
              {note.authorName} · Created {formatTimestamp(note.authoredOn)}
            </span>
            <span className="text-muted-foreground block text-xs">
              Updated {formatTimestamp(note.updatedAt)}
              {note.reviewedAt ? ` · Reviewed ${formatTimestamp(note.reviewedAt)}` : ""}
              {note.archivedAt ? ` · Archived ${formatTimestamp(note.archivedAt)}` : ""}
            </span>
          </CardDescription>
        </div>
        <Badge
          variant={statusVariant(note.status)}
          className="w-fit shrink-0 capitalize"
        >
          {note.status.replace("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        <p className="text-sm leading-relaxed">{note.summary}</p>
        {showModeration ? (
          <TransitionNoteModerationBar
            studentId={studentId}
            noteId={note.id}
            status={note.status}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
