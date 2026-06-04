import { FolderOpen } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

import { ProfileEmptyState } from "../profile-empty-state";
import { loadStudentFiles } from "../supabase-profile-data";
import type { StudentFile } from "../types";

const CARD_CHROME = "border-border/70 shadow-sm";
const TH = "text-muted-foreground text-xs font-semibold uppercase tracking-wide";

type FilesTabProps = {
  studentId: string;
};

function categoryVariant(
  category: StudentFile["category"],
): "default" | "secondary" | "outline" | "destructive" {
  if (category === "medical") return "destructive";
  if (category === "consent") return "default";
  if (category === "assessment") return "secondary";
  return "outline";
}

export async function FilesTab({ studentId }: FilesTabProps) {
  const loaded = await loadStudentFiles(studentId);

  if (loaded.kind === "error") {
    return (
      <Card className={CARD_CHROME}>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Files</CardTitle>
          <CardDescription>File metadata could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm" role="alert">
            {loaded.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const files = loaded.files;

  return (
    <Card className={CARD_CHROME}>
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-base">Files</CardTitle>
        <CardDescription>
          Report card PDFs and related storage paths from Supabase (same source as the
          report cards list).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {files.length === 0 ? (
          <ProfileEmptyState
            icon={FolderOpen}
            title="No files on file"
            description={
              <>
                Uploaded documents linked to this student will show label, category, and
                storage key—aligned with the report cards tab when the object is a term
                PDF.
              </>
            }
          />
        ) : (
          <>
            <p className="text-muted-foreground sm:hidden text-xs leading-relaxed">
              Swipe horizontally to see all columns.
            </p>
            <Table aria-label="Student files">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Label</TableHead>
                  <TableHead className={TH}>Category</TableHead>
                  <TableHead className={`${TH} hidden sm:table-cell`}>Uploaded</TableHead>
                  <TableHead className={`${TH} hidden lg:table-cell`}>Storage key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">{file.label}</TableCell>
                    <TableCell>
                      <Badge variant={categoryVariant(file.category)} className="capitalize">
                        {file.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                      <div className="flex flex-col">
                        <span>{file.uploadedOn}</span>
                        <span className="text-xs">{file.uploadedBy}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden font-mono text-xs lg:table-cell">
                      {file.storageKey}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
