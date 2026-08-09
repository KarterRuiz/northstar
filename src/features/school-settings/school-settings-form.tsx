"use client";

import * as React from "react";
import { useActionState } from "react";
import { ImageIcon, Upload } from "lucide-react";

import type { Role } from "@/config/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceSectionHeader } from "@/components/workspace/workspace-headers";
import {
  WorkspaceToast,
  useWorkspaceToast,
} from "@/components/workspace/workspace-toast";
import { HexColorField } from "@/features/school-settings/hex-color-field";
import {
  removeSchoolLogoAction,
  updateSchoolBrandingSettingsAction,
  updateSchoolInstitutionDetailsAction,
  updateSchoolOfficialDocumentsAction,
  uploadSchoolLogoAction,
  type SchoolSettingsMutationState,
} from "@/features/school-settings/school-settings-actions";
import {
  MAX_SCHOOL_LOGO_BYTES,
  SCHOOL_LOGO_MIME_TYPES,
} from "@/lib/school-settings/constants";
import type { SchoolSettingsRow } from "@/lib/school-settings/types";
import { resolveLogoExtension } from "@/lib/school-settings/validation";
import { cn } from "@/lib/utils";

const LOGO_ACCEPT = [...SCHOOL_LOGO_MIME_TYPES, ".png", ".jpg", ".jpeg", ".webp", ".svg"].join(
  ",",
);
const LOGO_MAX_MB = MAX_SCHOOL_LOGO_BYTES / (1024 * 1024);

function useMutationToast(
  state: SchoolSettingsMutationState | undefined,
  showToast: (kind: "success" | "error", message: string) => void,
) {
  const lastHandled = React.useRef<SchoolSettingsMutationState | undefined>(undefined);

  React.useEffect(() => {
    if (!state || state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      showToast("success", state.message ?? "Saved.");
    } else {
      showToast("error", state.message);
    }
  }, [state, showToast]);
}

function OptionalHint() {
  return <span className="text-muted-foreground font-normal">(optional)</span>;
}

function ReadOnlyField({
  label,
  value,
  className,
  preWrap,
}: {
  label: string;
  value: string;
  className?: string;
  preWrap?: boolean;
}) {
  return (
    <div className={className}>
      <dt className="ns-meta">{label}</dt>
      <dd className={cn("mt-0.5 text-sm", preWrap ? "whitespace-pre-wrap" : "font-medium")}>
        {value || "—"}
      </dd>
    </div>
  );
}

function ColorSwatchReadOnly({ label, color }: { label: string; color: string }) {
  const display = color || "—";
  return (
    <div>
      <dt className="ns-meta">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        {color ? (
          <span
            className="border-border size-6 shrink-0 rounded-md border shadow-xs"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        ) : null}
        <span className="font-mono text-sm uppercase tracking-wide">{display}</span>
      </dd>
    </div>
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
  const { toast, showToast } = useWorkspaceToast();

  const [institutionState, institutionAction, institutionPending] = useActionState(
    updateSchoolInstitutionDetailsAction,
    undefined,
  );
  const [brandingState, brandingAction, brandingPending] = useActionState(
    updateSchoolBrandingSettingsAction,
    undefined,
  );
  const [documentsState, documentsAction, documentsPending] = useActionState(
    updateSchoolOfficialDocumentsAction,
    undefined,
  );
  const [logoState, logoAction, logoPending] = useActionState(uploadSchoolLogoAction, undefined);
  const [removeState, removeAction, removePending] = useActionState(
    removeSchoolLogoAction,
    undefined,
  );

  useMutationToast(institutionState, showToast);
  useMutationToast(brandingState, showToast);
  useMutationToast(documentsState, showToast);
  useMutationToast(logoState, showToast);
  useMutationToast(removeState, showToast);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [clientLogoError, setClientLogoError] = React.useState<string | null>(null);

  const busy =
    institutionPending ||
    brandingPending ||
    documentsPending ||
    logoPending ||
    removePending;

  const [clearedForLogoState, setClearedForLogoState] = React.useState<
    SchoolSettingsMutationState | undefined
  >(undefined);
  if (logoState?.ok && logoState !== clearedForLogoState) {
    setClearedForLogoState(logoState);
    if (selectedFileName !== null) setSelectedFileName(null);
    if (clientLogoError !== null) setClientLogoError(null);
    if (localPreviewUrl !== null) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
  }

  React.useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  function assignLogoFile(file: File | null) {
    setClientLogoError(null);
    setLocalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (!file) {
      setSelectedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_SCHOOL_LOGO_BYTES) {
      setClientLogoError(`Logo must be ${LOGO_MAX_MB} MB or smaller.`);
      setSelectedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!resolveLogoExtension(file)) {
      setClientLogoError("Logo must be PNG, JPEG, WebP, or SVG.");
      setSelectedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFileName(file.name);
    setLocalPreviewUrl(URL.createObjectURL(file));
    if (fileInputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileInputRef.current.files = transfer.files;
    }
  }

  const displayLogoUrl = localPreviewUrl ?? logoPreviewUrl;

  return (
    <div className="space-y-10 sm:space-y-12">
      <WorkspaceToast toast={toast} />

      {/* —— Institution details —— */}
      <section
        id="institution-details"
        className="scroll-mt-24 space-y-5"
        aria-labelledby="institution-details-heading"
      >
        <WorkspaceSectionHeader
          id="institution-details-heading"
          eyebrow="Identity"
          title="Institution details"
          description={
            readOnly
              ? "School identity used on report cards and official records."
              : "School name and contact information used on report cards and official records."
          }
        />

        {readOnly ? (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <ReadOnlyField label="School name" value={settings.schoolName} />
            <ReadOnlyField label="Principal" value={settings.principalName} />
            <ReadOnlyField
              label="Address"
              value={settings.schoolAddress}
              className="sm:col-span-2"
              preWrap
            />
            <ReadOnlyField label="Phone" value={settings.schoolPhone} />
            <ReadOnlyField label="Email" value={settings.schoolEmail} />
            <ReadOnlyField label="Website" value={settings.website} className="sm:col-span-2" />
          </dl>
        ) : (
          <form action={institutionAction} className="space-y-5">
            <input type="hidden" name="dashboardRole" value={dashboardRole} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schoolName">School name</Label>
                <Input
                  id="schoolName"
                  name="schoolName"
                  defaultValue={settings.schoolName}
                  placeholder="e.g. Riverside Academy"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="principalName">
                  Principal <OptionalHint />
                </Label>
                <Input
                  id="principalName"
                  name="principalName"
                  defaultValue={settings.principalName}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="schoolAddress">
                  Address <OptionalHint />
                </Label>
                <Textarea
                  id="schoolAddress"
                  name="schoolAddress"
                  defaultValue={settings.schoolAddress}
                  rows={2}
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolPhone">
                  Phone <OptionalHint />
                </Label>
                <Input
                  id="schoolPhone"
                  name="schoolPhone"
                  type="tel"
                  defaultValue={settings.schoolPhone}
                  maxLength={40}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolEmail">
                  Email <OptionalHint />
                </Label>
                <Input
                  id="schoolEmail"
                  name="schoolEmail"
                  type="email"
                  defaultValue={settings.schoolEmail}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="website">
                  Website <OptionalHint />
                </Label>
                <Input
                  id="website"
                  name="website"
                  type="text"
                  inputMode="url"
                  defaultValue={settings.website}
                  placeholder="https://"
                  maxLength={300}
                />
              </div>
            </div>
            <Button type="submit" disabled={busy}>
              {institutionPending ? "Saving…" : "Save institution details"}
            </Button>
          </form>
        )}
      </section>

      {/* —— Branding (colors + logo) —— */}
      <section
        id="branding"
        className="border-border scroll-mt-24 space-y-6 border-t pt-10 sm:pt-12"
        aria-labelledby="branding-heading"
      >
        <WorkspaceSectionHeader
          id="branding-heading"
          eyebrow="Appearance"
          title="Branding"
          description="School colors and logo used on report cards and official records."
        />

        {readOnly ? (
          <div className="space-y-6">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <ColorSwatchReadOnly label="Primary color" color={settings.primaryColor} />
              <ColorSwatchReadOnly label="Secondary color" color={settings.secondaryColor} />
            </dl>
            <div className="space-y-2">
              <p className="ns-meta">Logo</p>
              {displayLogoUrl ? (
                <div className="border-border bg-card flex max-w-xs items-center justify-center rounded-xl border p-6 shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayLogoUrl}
                    alt="Current school logo"
                    className="max-h-24 w-auto object-contain"
                  />
                </div>
              ) : (
                <p className="ns-muted">No logo on file.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <form action={brandingAction} className="space-y-5">
              <input type="hidden" name="dashboardRole" value={dashboardRole} />
              <div className="grid gap-4 sm:grid-cols-2">
                <HexColorField
                  id="primaryColor"
                  name="primaryColor"
                  label="Primary color"
                  description="Main brand color on report cards."
                  defaultValue={settings.primaryColor}
                  fallback="#1e3a5f"
                />
                <HexColorField
                  id="secondaryColor"
                  name="secondaryColor"
                  label="Secondary color"
                  description="Accent color for official materials."
                  defaultValue={settings.secondaryColor}
                  fallback="#4a6fa5"
                />
              </div>
              <Button type="submit" disabled={busy}>
                {brandingPending ? "Saving…" : "Save branding colors"}
              </Button>
            </form>

            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="ns-card-title">School logo</h3>
                <p className="ns-muted">
                  PNG, JPEG, WebP, or SVG, up to {LOGO_MAX_MB} MB. Used on official report cards.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-start">
                <div
                  className={cn(
                    "border-border bg-card flex aspect-square max-w-[12rem] items-center justify-center rounded-xl border p-4 shadow-xs",
                    !displayLogoUrl && "bg-surface-muted border-dashed",
                  )}
                >
                  {displayLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayLogoUrl}
                      alt={
                        localPreviewUrl ? "Selected school logo preview" : "Current school logo"
                      }
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-muted-foreground flex flex-col items-center gap-2 text-center">
                      <ImageIcon className="size-8 opacity-50" aria-hidden />
                      <span className="text-xs">No logo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <form
                    action={logoAction}
                    className="space-y-3"
                    onDragEnter={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDragActive(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDragActive(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDragActive(false);
                      const file = event.dataTransfer.files?.[0] ?? null;
                      assignLogoFile(file);
                    }}
                  >
                    <input type="hidden" name="dashboardRole" value={dashboardRole} />
                    <div
                      className={cn(
                        "border-border rounded-xl border border-dashed p-4 transition-colors",
                        dragActive && "border-primary bg-primary/5",
                      )}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="logo" className="inline-flex items-center gap-1.5">
                            <Upload className="size-3.5 opacity-70" aria-hidden />
                            {settings.logoStoragePath
                              ? "Replace school logo"
                              : "Upload school logo"}
                          </Label>
                          <p className="ns-meta">
                            Drag and drop an image here, or choose a file.
                          </p>
                          {selectedFileName ? (
                            <p className="text-sm">Selected: {selectedFileName}</p>
                          ) : null}
                          {localPreviewUrl && selectedFileName ? (
                            <p className="ns-meta">Preview of selected file — upload to apply.</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Choose file
                          </Button>
                          <Button
                            type="submit"
                            variant="secondary"
                            disabled={busy || logoPending || !selectedFileName}
                          >
                            {logoPending
                              ? "Uploading…"
                              : settings.logoStoragePath
                                ? "Replace logo"
                                : "Upload logo"}
                          </Button>
                        </div>
                      </div>
                      <Input
                        ref={fileInputRef}
                        id="logo"
                        name="logo"
                        type="file"
                        accept={LOGO_ACCEPT}
                        className="sr-only"
                        tabIndex={-1}
                        onChange={(event) => {
                          assignLogoFile(event.target.files?.[0] ?? null);
                        }}
                      />
                    </div>
                    {clientLogoError ? (
                      <p className="text-destructive text-sm" role="alert">
                        {clientLogoError}
                      </p>
                    ) : null}
                  </form>

                  {settings.logoStoragePath ? (
                    <form action={removeAction}>
                      <input type="hidden" name="dashboardRole" value={dashboardRole} />
                      <Button type="submit" variant="outline" size="sm" disabled={busy}>
                        {removePending ? "Removing…" : "Remove logo"}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* —— Official documents —— */}
      <section
        id="official-documents"
        className="border-border scroll-mt-24 space-y-5 border-t pt-10 sm:pt-12"
        aria-labelledby="official-documents-heading"
      >
        <WorkspaceSectionHeader
          id="official-documents-heading"
          eyebrow="Records"
          title="Official documents"
          description="Footer text shown at the bottom of official report cards."
        />

        {readOnly ? (
          <dl className="grid gap-4 text-sm">
            <ReadOnlyField
              label="Report card footer"
              value={settings.reportCardFooter}
              preWrap
            />
          </dl>
        ) : (
          <form action={documentsAction} className="space-y-5">
            <input type="hidden" name="dashboardRole" value={dashboardRole} />
            <div className="space-y-2">
              <Label htmlFor="reportCardFooter">
                Report card footer <OptionalHint />
              </Label>
              <Textarea
                id="reportCardFooter"
                name="reportCardFooter"
                defaultValue={settings.reportCardFooter}
                rows={3}
                maxLength={2000}
                placeholder="Optional legal line, accreditation, or contact block"
              />
            </div>
            <Button type="submit" disabled={busy}>
              {documentsPending ? "Saving…" : "Save official documents"}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
