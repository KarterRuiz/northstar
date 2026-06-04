import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { ReportCardStandardsPlaceholder } from "./types";

const PLACEHOLDER: ReportCardStandardsPlaceholder = {
  enabled: false,
  subjects: [],
};

export function ReportCardStandardsPlaceholderSection() {
  return (
    <Card className="border-dashed opacity-90">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Standards-based grading</CardTitle>
        <p className="text-muted-foreground text-xs">Coming soon</p>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-2 text-xs leading-relaxed">
        <p>
          Placeholder for future subject strands and rubric summaries (
          {PLACEHOLDER.subjects.length} subjects configured in types).
        </p>
        <ul className="list-inside list-disc">
          <li>Per-subject proficiency strands</li>
          <li>Rubric rollups by term</li>
          <li>Standards narrative alongside teacher comment</li>
        </ul>
      </CardContent>
    </Card>
  );
}
