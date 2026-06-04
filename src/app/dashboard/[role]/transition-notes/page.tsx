import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isRole } from "@/config/roles";

type PageProps = {
  params: Promise<{ role: string }>;
};

export default async function TransitionNotesIndexPage({ params }: PageProps) {
  const { role } = await params;
  if (!isRole(role)) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6 sm:p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Transition notes
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Drafts and submissions are stored in Supabase. Teachers pick a student,
          compose on the new note page, and submitted notes appear on the student
          profile for leadership review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teacher handoff</CardTitle>
          <CardDescription>
            Teachers create structured notes from the roster picker; leadership reviews
            them on each student&apos;s transition tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {role === "teacher" ? (
            <Button asChild>
              <Link href={`/dashboard/${role}/transition-notes/new`}>
                New transition note
              </Link>
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              Switch to the teacher role to compose transition notes.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
