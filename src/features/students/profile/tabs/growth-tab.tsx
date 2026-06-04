import { Sprout } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ProfileEmptyState } from "../profile-empty-state";

const CARD_CHROME = "border-border/70 shadow-sm";

export function GrowthTab() {
  return (
    <Card className={CARD_CHROME}>
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-base">Growth</CardTitle>
        <CardDescription>
          Developmental progress, goals, and longitudinal growth data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileEmptyState
          icon={Sprout}
          title="Growth tracking coming soon"
          description="This tab will surface growth metrics and goal progress when a growth model is connected to student records."
        />
      </CardContent>
    </Card>
  );
}
