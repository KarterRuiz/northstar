"use client";

import { useActionState } from "react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  removeSchoolLogoAction,
  updateSchoolSettingsAction,
  uploadSchoolLogoAction,
  type SchoolSettingsMutationState,
} from "@/features/school-settings/school-settings-actions";
import type { SchoolSettingsRow } from "@/lib/school-settings/types";

function Feedback({ state }: { state: SchoolSettingsMutationState | undefined }) {
  if (!state?.message) return null;
  if (state.ok) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
        {state.message}
      </p>
    );
  }
  return (
    <p className="text-destructive text-sm" role="alert">
      {state.message}
    </p>
  );
}

export function SchoolSettingsForm({
  dashboardRole,
  settings,
  logoPreviewUrl,
  readOnly,
}: {
  dashboardRole: Role;
  settings: SchoolSettingsRow;
  logoPreviewUrl: string | null;
  readOnly: boolean;
}) {
  const [saveState, saveAction, savePending] = useActionState(updateSchoolSettingsAction, undefined);
  const [logoState, logoAction, logoPending] = useActionState(uploadSchoolLogoAction, undefined);
  const [removeState, removeAction, removePending] = useActionState(removeSchoolLogoAction, undefined);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Institution identity</CardTitle>
          <CardDescription>
            {readOnly
              ? "Official name and branding used on report cards and records. Contact leadership to request changes."
              : "Name and branding appear on report card previews and official documents—not the Northstar platform label."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {readOnly ? (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">School name</dt>
                <dd className="font-medium">{settings.schoolName || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Principal</dt>
                <dd>{settings.principalName || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Address</dt>
                <dd className="whitespace-pre-wrap">{settings.schoolAddress || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{settings.schoolPhone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>{settings.schoolEmail || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Website</dt>
                <dd>{settings.website || "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Report card footer</dt>
                <dd className="whitespace-pre-wrap">{settings.reportCardFooter || "—"}</dd>
              </div>
            </dl>
          ) : (
            <form action={saveAction} className="space-y-5">
              <input type="hidden" name="dashboardRole" value={dashboardRole} />
              <div className="grid gap-4 sm:grid-cols-2">

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="schoolName">School name</Label>
                  <Input id="schoolName" name="schoolName" defaultValue={settings.schoolName} placeholder="e.g. Riverside Academy" maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="principalName">Principal name</Label>
                  <Input id="principalName" name="principalName" defaultValue={settings.principalName} maxLength={200} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="schoolAddress">Address</Label>
                  <Textarea id="schoolAddress" name="schoolAddress" defaultValue={settings.schoolAddress} rows={2} maxLength={500} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolPhone">Phone</Label>
                  <Input id="schoolPhone" name="schoolPhone" type="tel" defaultValue={settings.schoolPhone} maxLength={40} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolEmail">Email</Label>
                  <Input id="schoolEmail" name="schoolEmail" type="email" defaultValue={settings.schoolEmail} maxLength={200} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" name="website" type="url" defaultValue={settings.website} placeholder="https://" maxLength={300} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary color</Label>
                  <Input id="primaryColor" name="primaryColor" type="color" defaultValue={settings.primaryColor || "#1e3a5f"} className="h-10 w-full max-w-[12rem] cursor-pointer p-1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary color</Label>
                  <Input id="secondaryColor" name="secondaryColor" type="color" defaultValue={settings.secondaryColor || "#4a6fa5"} className="h-10 w-full max-w-[12rem] cursor-pointer p-1" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="reportCardFooter">Report card footer</Label>
                  <Textarea id="reportCardFooter" name="reportCardFooter" defaultValue={settings.reportCardFooter} rows={3} maxLength={2000} placeholder="Optional legal line, accreditation, or contact block" />
                </div>
              </div>
              <Feedback state={saveState} />
              <Button type="submit" disabled={savePending}>{savePending ? "Saving…" : "Save settings"}</Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School logo</CardTitle>
          <CardDescription>Shown on report card previews when uploaded (PNG, JPEG, WebP, or SVG, max 2 MB).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoPreviewUrl ? (
            <div className="border-border bg-muted/30 flex max-w-xs items-center justify-center rounded-lg border p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoPreviewUrl} alt="" className="max-h-20 w-auto object-contain" />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No logo on file.</p>
          )}
          {!readOnly ? (
            <>
              <form action={logoAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="dashboardRole" value={dashboardRole} />
                <div className="space-y-2">
                  <Label htmlFor="logo">Upload logo</Label>
                  <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
                </div>
                <Button type="submit" variant="secondary" disabled={logoPending}>{logoPending ? "Uploading…" : "Upload"}</Button>
              </form>
              <Feedback state={logoState} />
              {settings.logoStoragePath ? (
                <form action={removeAction}>
                  <input type="hidden" name="dashboardRole" value={dashboardRole} />
                  <Button type="submit" variant="outline" size="sm" disabled={removePending}>{removePending ? "Removing…" : "Remove logo"}</Button>
                  <Feedback state={removeState} />
                </form>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
