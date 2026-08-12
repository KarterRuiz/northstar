"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";

import type { Role } from "@/config/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { autoMapColumnsDetailed, mappingCompleteness, materializeRowsFromMatrix } from "./auto-map-columns";
import { detectHeaderRow } from "./detect-roster-structure";
import { ROSTER_FIELD_CATALOG, type RosterFieldId } from "./field-catalog";
import {
  applyRosterImportBatchAction,
  buildRosterErrorReportAction,
  buildRosterImportReportAction,
  getRosterTemplateCsvAction,
  getRosterTemplateXlsxAction,
  parseRosterUploadAction,
  validateRosterImportAction,
} from "./roster-import-actions";
import type {
  ColumnMapping,
  ColumnMappingOrigins,
  ParsedRosterFile,
  RosterImportOptions,
  RosterImportPlan,
  RosterImportSummary,
} from "./types";
import { DEFAULT_ROSTER_IMPORT_OPTIONS } from "./types";

type WizardStep =
  | "upload"
  | "sheet"
  | "mapping"
  | "validation"
  | "summary"
  | "importing"
  | "done";

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "mapping", label: "Map columns" },
  { id: "validation", label: "Validate" },
  { id: "summary", label: "Review" },
  { id: "importing", label: "Import" },
  { id: "done", label: "Done" },
];

type RosterImportWizardProps = {
  dashboardRole: Role;
  schoolYearLabel: string | null;
};

function downloadTextFile(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBase64File(base64: string, fileName: string, mime: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const nativeSelectClassName = cn(
  "border-input bg-background ring-offset-background text-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
);

export function RosterImportWizard({
  dashboardRole,
  schoolYearLabel,
}: RosterImportWizardProps) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  const [fileMeta, setFileMeta] = useState<ParsedRosterFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mappingOrigins, setMappingOrigins] = useState<ColumnMappingOrigins>({});
  const [ambiguousHeaders, setAmbiguousHeaders] = useState<string[]>([]);
  const [showHeaderPicker, setShowHeaderPicker] = useState(false);
  const [plan, setPlan] = useState<RosterImportPlan | null>(null);
  const [cataloguedNote, setCataloguedNote] = useState<string[]>([]);
  const [options, setOptions] = useState<RosterImportOptions>({
    ...DEFAULT_ROSTER_IMPORT_OPTIONS,
  });

  const [progress, setProgress] = useState({
    processed: 0,
    total: 0,
    remaining: 0,
    added: 0,
    updated: 0,
    archived: 0,
    gradesCreated: 0,
    classesCreated: 0,
    errors: [] as { rowNumber: number; message: string }[],
  });
  const [summary, setSummary] = useState<RosterImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedFileRef = useRef<File | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const mappingStatus = useMemo(() => mappingCompleteness(mapping), [mapping]);

  const mappingFields = useMemo(() => {
    return ROSTER_FIELD_CATALOG.filter(
      (f) => f.status === "importable" || Boolean(mapping[f.id]),
    );
  }, [mapping]);

  const samplePreview = useMemo(() => {
    if (!fileMeta) return [];
    const fields = mappingFields.filter((f) => mapping[f.id]);
    if (fields.length === 0) return [];
    return fileMeta.rows.slice(0, 5).map((row, index) => ({
      rowNumber: fileMeta.headerRowNumber + 1 + index,
      cells: fields.map((f) => ({
        fieldId: f.id,
        label: f.label,
        value: row[mapping[f.id]!] ?? "",
      })),
    }));
  }, [fileMeta, mapping, mappingFields]);

  const applyParseResult = useCallback(
    (result: {
      file: ParsedRosterFile;
      suggestedMapping: ColumnMapping;
      mappingOrigins: ColumnMappingOrigins;
      ambiguousHeaders: string[];
    }) => {
      setFileMeta(result.file);
      setMapping(result.suggestedMapping);
      setMappingOrigins(result.mappingOrigins);
      setAmbiguousHeaders(result.ambiguousHeaders);
      setPlan(null);
      setSummary(null);
      setShowHeaderPicker(result.file.needsHeaderRowSelection);
      if (result.file.needsSheetSelection) {
        setStep("sheet");
      } else {
        setStep("mapping");
      }
    },
    [],
  );

  const handleFile = useCallback(
    (file: File | null, overrides?: { sheetName?: string; headerRowIndex?: number }) => {
      if (!file) return;
      setError(null);
      uploadedFileRef.current = file;
      const fd = new FormData();
      fd.set("file", file);
      if (overrides?.sheetName) fd.set("sheetName", overrides.sheetName);
      if (overrides?.headerRowIndex != null) {
        fd.set("headerRowIndex", String(overrides.headerRowIndex));
      }
      startTransition(async () => {
        try {
          const result = await parseRosterUploadAction(dashboardRole, fd);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          applyParseResult(result);
        } catch {
          setError("Could not read that file. Check that it is a valid CSV or Excel workbook.");
        }
      });
    },
    [applyParseResult, dashboardRole],
  );

  const downloadCsvTemplate = () => {
    startTransition(async () => {
      try {
        const result = await getRosterTemplateCsvAction(dashboardRole);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        downloadTextFile(result.csv, result.fileName, "text/csv;charset=utf-8");
      } catch {
        setError("Could not download the CSV template. Try again.");
      }
    });
  };

  const downloadXlsxTemplate = () => {
    startTransition(async () => {
      try {
        const result = await getRosterTemplateXlsxAction(dashboardRole);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        downloadBase64File(
          result.base64,
          result.fileName,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
      } catch {
        setError("Could not download the Excel template. Try again.");
      }
    });
  };

  const runValidation = (nextOptions: RosterImportOptions, nextStep: WizardStep) => {
    if (!fileMeta) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await validateRosterImportAction({
          dashboardRole,
          rows: fileMeta.rows,
          mapping,
          headerRowNumber: fileMeta.headerRowNumber,
          options: nextOptions,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setPlan(result.plan);
        setCataloguedNote(result.cataloguedFieldsMapped.map((f) => f.label));
        setStep(nextStep);
      } catch {
        setError("Could not validate this roster. Try again.");
      }
    });
  };

  const chooseSheet = (sheetName: string) => {
    const file = uploadedFileRef.current;
    if (!file) {
      setError("Upload the file again to choose a worksheet.");
      setStep("upload");
      return;
    }
    handleFile(file, { sheetName });
  };

  const chooseHeaderRow = (headerRowIndex: number) => {
    if (!fileMeta) return;
    setError(null);
    const { headers, rows } = materializeRowsFromMatrix(fileMeta.matrix, headerRowIndex);
    if (headers.length === 0) {
      setError("No column headers were found on that row.");
      return;
    }
    if (rows.length === 0) {
      setError("No student rows were found under that header row.");
      return;
    }
    const detection = detectHeaderRow(fileMeta.matrix);
    const suggested = autoMapColumnsDetailed(headers);
    applyParseResult({
      file: {
        ...fileMeta,
        headers,
        rows,
        headerRowIndex,
        headerRowNumber: headerRowIndex + 1,
        headerDetectionConfidence: "high",
        headerCandidates: detection.candidates,
        needsHeaderRowSelection: false,
        needsSheetSelection: false,
      },
      suggestedMapping: suggested.mapping,
      mappingOrigins: suggested.origins,
      ambiguousHeaders: suggested.ambiguousHeaders,
    });
    setShowHeaderPicker(false);
    setStep("mapping");
  };

  const downloadErrorReport = () => {
    if (!plan) return;
    startTransition(async () => {
      try {
        const result = await buildRosterErrorReportAction(
          dashboardRole,
          plan.issues.map((i) => ({
            rowNumber: i.rowNumber,
            severity: i.severity,
            message: i.message,
            field: i.field,
          })),
        );
        if (!result.ok) {
          setError(result.message);
          return;
        }
        downloadTextFile(
          result.csv,
          "northstar-roster-validation-errors.csv",
          "text/csv;charset=utf-8",
        );
      } catch {
        setError("Could not build the error report. Try again.");
      }
    });
  };

  const executeImport = async (
    freshPlan: RosterImportPlan,
    importOptions: RosterImportOptions,
  ) => {
    setError(null);
    setStep("importing");
    setProgress({
      processed: 0,
      total: freshPlan.rows.length,
      remaining: freshPlan.rows.length,
      added: 0,
      updated: 0,
      archived: 0,
      gradesCreated: 0,
      classesCreated: 0,
      errors: [],
    });

    let cursor = 0;
    let plannedRows = freshPlan.rows.map((r) => ({ ...r }));
    let added = 0;
    let updated = 0;
    let archived = 0;
    let gradesCreated = 0;
    let classesCreated = 0;
    const errors: { rowNumber: number; message: string }[] = [];
    let bootstrap = true;

    try {
      while (cursor < plannedRows.length) {
        const batch = await applyRosterImportBatchAction({
          dashboardRole,
          options: importOptions,
          plannedRows,
          leavingStudents: freshPlan.leavingStudents,
          cursor,
          batchSize: 25,
          bootstrap,
          totalsSoFar: {
            added,
            updated,
            archived,
            gradesCreated,
            classesCreated,
            errorCount: errors.length,
          },
        });

        if (!batch.ok) {
          setError(batch.message);
          setStep("summary");
          return;
        }

        bootstrap = false;
        plannedRows = batch.plannedRows;
        cursor = batch.cursor;
        added += batch.added;
        updated += batch.updated;
        archived += batch.archived;
        gradesCreated += batch.gradesCreated;
        classesCreated += batch.classesCreated;
        errors.push(...batch.errors);

        setProgress({
          processed: batch.processed,
          total: plannedRows.length,
          remaining: batch.remaining,
          added,
          updated,
          archived,
          gradesCreated,
          classesCreated,
          errors: [...errors],
        });

        if (batch.done) break;
      }
    } catch {
      setError("Import stopped unexpectedly. Review the progress below and try again.");
      setStep("summary");
      return;
    }

    setSummary({
      added,
      updated,
      archived,
      errors,
      gradesCreated,
      classesCreated,
    });
    setStep("done");
  };

  const startImport = () => {
    if (!fileMeta) return;
    startTransition(async () => {
      try {
        const result = await validateRosterImportAction({
          dashboardRole,
          rows: fileMeta.rows,
          mapping,
          headerRowNumber: fileMeta.headerRowNumber,
          options,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setPlan(result.plan);
        setCataloguedNote(result.cataloguedFieldsMapped.map((f) => f.label));

        if (result.plan.blockingErrorCount > 0) {
          setError(
            "There are still blocking errors. Fix the file, or enable auto-create for missing grades/classes and re-check.",
          );
          setStep("validation");
          return;
        }

        if (!options.createNew && !options.updateExisting && !options.archiveWithdrawn) {
          setError("Choose at least one import action: create, update, or archive.");
          return;
        }

        await executeImport(result.plan, options);
      } catch {
        setError("Could not start the import. Try again.");
      }
    });
  };

  const downloadImportReport = () => {
    if (!summary) return;
    startTransition(async () => {
      try {
        const result = await buildRosterImportReportAction(dashboardRole, summary);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        downloadTextFile(
          result.csv,
          "northstar-roster-import-report.csv",
          "text/csv;charset=utf-8",
        );
      } catch {
        setError("Could not build the import report. Try again.");
      }
    });
  };

  const setMappedField = (fieldId: RosterFieldId, header: string) => {
    setMapping((prev) => ({
      ...prev,
      [fieldId]: header === "" ? null : header,
    }));
    setMappingOrigins((prev) => {
      const next = { ...prev };
      if (header === "") {
        delete next[fieldId];
      } else {
        next[fieldId] = "manual";
      }
      return next;
    });
  };

  const mappingBadge = (fieldId: RosterFieldId, required: boolean) => {
    const header = mapping[fieldId];
    if (!header) {
      return {
        label: required ? "Required · Not mapped" : "Optional · Not mapped",
        className: required
          ? "bg-amber-500/15 text-amber-900 dark:text-amber-100"
          : undefined,
      };
    }
    if (mappingOrigins[fieldId] === "auto") {
      return { label: "Auto-matched", className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" };
    }
    if (mappingOrigins[fieldId] === "manual") {
      return { label: "Manually mapped", className: undefined };
    }
    return { label: "Mapped", className: undefined };
  };

  const canProceedFromMapping = mappingStatus.missingRequired.length === 0;
  const blockingErrors = plan?.blockingErrorCount ?? 0;

  return (
    <div className="space-y-6">
      <nav aria-label="Import steps">
        <ol className="flex flex-wrap items-center gap-1 text-sm">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const done = i < stepIndex;
            return (
              <li key={s.id} className="flex items-center gap-1">
                {i > 0 ? (
                  <ChevronRight className="text-muted-foreground size-3.5 shrink-0" />
                ) : null}
                <span
                  className={cn(
                    "rounded-md px-2 py-1",
                    active && "bg-primary/10 text-primary font-medium",
                    done && !active && "text-foreground",
                    !active && !done && "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {schoolYearLabel ? (
        <p className="text-muted-foreground text-sm">
          Importing into school year{" "}
          <span className="text-foreground font-medium">{schoolYearLabel}</span>.
        </p>
      ) : (
        <p className="text-amber-800 dark:text-amber-200 bg-amber-500/10 rounded-lg border border-amber-500/25 px-3 py-2 text-sm">
          No current school year is set. Enrollments need an active school year — set one
          in School settings before importing.
        </p>
      )}

      {error ? (
        <div
          className="bg-destructive/10 text-destructive rounded-lg border border-destructive/30 px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {step === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload roster</CardTitle>
            <CardDescription>
              CSV or Excel (.xlsx). Download a blank template, fill it from your SIS or
              spreadsheet, then upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={downloadCsvTemplate}
              >
                <Download className="size-4" />
                CSV template
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={downloadXlsxTemplate}
              >
                <Download className="size-4" />
                Excel template
              </Button>
            </div>

            <div
              className={cn(
                "border-muted-foreground/25 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center transition-colors",
                dragOver && "border-primary bg-primary/5",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0] ?? null);
              }}
            >
              <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                {pending ? (
                  <Loader2 className="text-muted-foreground size-6 animate-spin" />
                ) : (
                  <Upload className="text-muted-foreground size-6" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Drag and drop your roster here</p>
                <p className="text-muted-foreground text-xs">
                  .csv or .xlsx · up to 5,000 rows · 8 MB max
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="size-4" />
                Browse files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => {
                  handleFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "sheet" && fileMeta ? (
        <Card>
          <CardHeader>
            <CardTitle>Which worksheet has the roster?</CardTitle>
            <CardDescription>
              This workbook has more than one sheet, and it isn’t clear which one is the
              student list. Pick the sheet to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fileMeta.availableSheets.map((sheet) => (
              <button
                key={sheet.name}
                type="button"
                disabled={pending}
                onClick={() => chooseSheet(sheet.name)}
                className="hover:bg-muted/60 flex w-full flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors"
              >
                <span className="font-medium">{sheet.name}</span>
                <span className="text-muted-foreground text-xs">
                  ~{sheet.rowCount} data rows · {sheet.preview}
                </span>
              </button>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFileMeta(null);
                setMapping({});
                setMappingOrigins({});
                setStep("upload");
              }}
            >
              Back
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === "mapping" && fileMeta ? (
        <Card>
          <CardHeader>
            <CardTitle>Map columns</CardTitle>
            <CardDescription>
              Matched common headers from{" "}
              <span className="font-medium">{fileMeta.fileName}</span>
              {fileMeta.sheetName ? (
                <>
                  {" "}
                  · sheet <span className="font-medium">{fileMeta.sheetName}</span>
                </>
              ) : null}{" "}
              ({fileMeta.rows.length} students). Adjust anything that looks wrong before
              validating.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <span>
                Header row detected:{" "}
                <span className="font-medium">Row {fileMeta.headerRowNumber}</span>
                {fileMeta.headerDetectionConfidence !== "high" ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {fileMeta.headerDetectionConfidence} confidence
                  </span>
                ) : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                disabled={pending}
                onClick={() => setShowHeaderPicker((v) => !v)}
              >
                Change
              </Button>
            </div>

            {showHeaderPicker || fileMeta.needsHeaderRowSelection ? (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">
                  Which row contains your column headings?
                </p>
                <p className="text-muted-foreground text-xs">
                  Choose the row with labels like First Name, Class, Student ID — not the
                  school title or year.
                </p>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {fileMeta.headerCandidates.map((candidate) => (
                    <button
                      key={candidate.rowIndex}
                      type="button"
                      disabled={pending}
                      onClick={() => chooseHeaderRow(candidate.rowIndex)}
                      className={cn(
                        "hover:bg-muted/60 flex w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-sm",
                        candidate.rowIndex === fileMeta.headerRowIndex &&
                          "border-primary bg-primary/5",
                      )}
                    >
                      <span className="font-medium">Row {candidate.rowNumber}</span>
                      <span className="text-muted-foreground text-xs">
                        {candidate.preview.join(" · ") || "(empty)"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {ambiguousHeaders.length > 0 ? (
              <p className="text-muted-foreground text-sm">
                Left unmapped on purpose (ambiguous name columns — map First/Last
                manually if needed): {ambiguousHeaders.join(", ")}.
              </p>
            ) : null}

            {mappingStatus.missingRequired.length > 0 ? (
              <p className="text-amber-800 dark:text-amber-200 bg-amber-500/10 rounded-lg border border-amber-500/25 px-3 py-2 text-sm">
                Required fields still unmapped:{" "}
                {mappingStatus.missingRequired
                  .map(
                    (id) => ROSTER_FIELD_CATALOG.find((f) => f.id === id)?.label ?? id,
                  )
                  .join(", ")}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                {mappingStatus.mappedCount} fields mapped. Required fields look good.
              </p>
            )}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NorthStar field</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Your column</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappingFields.map((field) => {
                    const badge = mappingBadge(field.id, field.required);
                    return (
                      <TableRow key={field.id}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium">
                              {field.label}
                              {field.required ? (
                                <span className="text-destructive"> *</span>
                              ) : null}
                            </p>
                            {field.description ? (
                              <p className="text-muted-foreground text-xs">
                                {field.description}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(badge.className)}
                          >
                            {badge.label}
                          </Badge>
                          {field.status === "catalogued" ? (
                            <span className="text-muted-foreground mt-1 block text-xs">
                              Recognized for later imports
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="min-w-[12rem]">
                          <select
                            className={nativeSelectClassName}
                            value={mapping[field.id] ?? ""}
                            onChange={(e) => setMappedField(field.id, e.target.value)}
                            aria-label={`Map ${field.label}`}
                          >
                            <option value="">— Not mapped —</option>
                            {fileMeta.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {canProceedFromMapping && samplePreview.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Sample rows (first 5)</p>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        {samplePreview[0]?.cells.map((c) => (
                          <TableHead key={c.fieldId}>{c.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {samplePreview.map((row) => (
                        <TableRow key={row.rowNumber}>
                          <TableCell className="text-muted-foreground">
                            {row.rowNumber}
                          </TableCell>
                          {row.cells.map((c) => (
                            <TableCell key={c.fieldId}>{c.value || "—"}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFileMeta(null);
                  setMapping({});
                  setMappingOrigins({});
                  setAmbiguousHeaders([]);
                  setPlan(null);
                  setStep("upload");
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={pending || !canProceedFromMapping}
                onClick={() => runValidation(options, "validation")}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Validating…
                  </>
                ) : (
                  "Validate roster"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "validation" && plan ? (
        <Card>
          <CardHeader>
            <CardTitle>Validation</CardTitle>
            <CardDescription>
              Review issues before importing. Errors must be fixed (or auto-create enabled
              on the next step) before you can import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Rows checked" value={plan.rows.length} />
              <Stat
                label="Errors"
                value={plan.blockingErrorCount}
                tone={plan.blockingErrorCount > 0 ? "danger" : "ok"}
              />
              <Stat
                label="Warnings"
                value={plan.issues.filter((i) => i.severity === "warning").length}
              />
            </div>

            {cataloguedNote.length > 0 ? (
              <p className="text-muted-foreground text-sm">
                Mapped for future imports (not written yet): {cataloguedNote.join(", ")}.
              </p>
            ) : null}

            {plan.issues.length === 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                No validation issues. Ready to review the import plan.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
                {plan.issues.slice(0, 200).map((issue, idx) => (
                  <p
                    key={`${issue.rowNumber}-${issue.code}-${idx}`}
                    className={cn(
                      "text-sm",
                      issue.severity === "error"
                        ? "text-destructive"
                        : "text-amber-800 dark:text-amber-200",
                    )}
                  >
                    <span className="font-medium">
                      Row {issue.rowNumber}
                      {issue.severity === "warning" ? " (warning)" : ""}:
                    </span>{" "}
                    {issue.message}
                  </p>
                ))}
                {plan.issues.length > 200 ? (
                  <p className="text-muted-foreground text-xs">
                    Showing first 200 of {plan.issues.length} issues. Download the full
                    report.
                  </p>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("mapping")}>
                Back to mapping
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending || plan.issues.length === 0}
                onClick={downloadErrorReport}
              >
                <Download className="size-4" />
                Download error report
              </Button>
              <Button type="button" disabled={pending} onClick={() => setStep("summary")}>
                Continue to review
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "summary" && plan ? (
        <Card>
          <CardHeader>
            <CardTitle>Import plan</CardTitle>
            <CardDescription>
              Confirm what will change, then choose how to handle existing and missing
              records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Existing students" value={plan.existingCount} />
              <Stat label="New students" value={plan.newCount} />
              <Stat label="Changing classes" value={plan.classChangeCount} />
              <Stat label="Students leaving" value={plan.leavingStudents.length} />
            </div>

            {(plan.missingGrades.length > 0 || plan.missingClasses.length > 0) &&
            !options.createMissingGrades &&
            !options.createMissingClasses ? (
              <p className="text-amber-800 dark:text-amber-200 bg-amber-500/10 rounded-lg border border-amber-500/25 px-3 py-2 text-sm">
                Some grades or classes in the file are not in NorthStar yet. Enable
                auto-create below, or add them in School settings / Classes first.
              </p>
            ) : null}

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Import choices</legend>
              <OptionCheck
                id="opt-update"
                checked={options.updateExisting}
                onChange={(v) => setOptions((o) => ({ ...o, updateExisting: v }))}
                label="Update existing records"
                description="Match by student number / external ID and refresh name, preferred name, and class."
              />
              <OptionCheck
                id="opt-create"
                checked={options.createNew}
                onChange={(v) => setOptions((o) => ({ ...o, createNew: v }))}
                label="Create new students"
                description="Add roster rows that do not match an existing student number."
              />
              <OptionCheck
                id="opt-archive"
                checked={options.archiveWithdrawn}
                onChange={(v) => setOptions((o) => ({ ...o, archiveWithdrawn: v }))}
                label="Archive withdrawn students"
                description={`Mark active ${schoolYearLabel ?? "current-year"} enrollments as withdrawn when the student is missing from this roster (requires student numbers in the file). ${plan.leavingStudents.length} student(s) would be archived.`}
              />
              <OptionCheck
                id="opt-grades"
                checked={options.createMissingGrades}
                onChange={(v) => setOptions((o) => ({ ...o, createMissingGrades: v }))}
                label="Create missing grade levels"
                description={
                  plan.missingGrades.length > 0
                    ? `Would create: ${plan.missingGrades.join(", ")}`
                    : "No missing grades detected with current mapping."
                }
              />
              <OptionCheck
                id="opt-classes"
                checked={options.createMissingClasses}
                onChange={(v) => setOptions((o) => ({ ...o, createMissingClasses: v }))}
                label="Create missing classes"
                description={
                  plan.missingClasses.length > 0
                    ? `Would create: ${plan.missingClasses
                        .map((c) =>
                          c.gradeLabel
                            ? `${c.gradeLabel} · ${c.classLabel}`
                            : c.classLabel,
                        )
                        .join(", ")}`
                    : "No missing classes detected with current mapping."
                }
              />
            </fieldset>

            {plan.leavingStudents.length > 0 && options.archiveWithdrawn ? (
              <div className="max-h-40 overflow-y-auto rounded-md border p-3 text-sm">
                <p className="mb-2 font-medium">Students leaving</p>
                <ul className="text-muted-foreground list-inside list-disc space-y-1">
                  {plan.leavingStudents.slice(0, 50).map((s) => (
                    <li key={s.studentId}>
                      {s.fullName}
                      {s.externalId ? ` (${s.externalId})` : ""} · {s.classLabel}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {blockingErrors > 0 &&
            !(options.createMissingClasses || options.createMissingGrades) ? (
              <p className="text-destructive text-sm" role="alert">
                {blockingErrors} validation error(s) remain. Go back to fix the file, or
                enable auto-create for missing grades/classes and re-check.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("validation")}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => runValidation(options, "summary")}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Re-checking…
                  </>
                ) : (
                  "Re-check with these choices"
                )}
              </Button>
              <Button type="button" disabled={pending} onClick={startImport}>
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  "Start import"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "importing" ? (
        <Card>
          <CardHeader>
            <CardTitle>Importing…</CardTitle>
            <CardDescription>
              Applying roster changes. Keep this page open until finished.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Processed {progress.processed} of {progress.total} · {progress.remaining}{" "}
              remaining
              {progress.errors.length > 0
                ? ` · ${progress.errors.length} error(s)`
                : ""}
            </div>
            <div
              className="bg-muted h-2 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={progress.processed}
              aria-valuemin={0}
              aria-valuemax={progress.total || 1}
            >
              <div
                className="bg-primary h-full transition-all"
                style={{
                  width: `${
                    progress.total === 0
                      ? 0
                      : Math.round((progress.processed / progress.total) * 100)
                  }%`,
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Added" value={progress.added} />
              <Stat label="Updated" value={progress.updated} />
              <Stat label="Errors" value={progress.errors.length} tone="danger" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "done" && summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Import complete
            </CardTitle>
            <CardDescription>
              Summary of what changed. Download a report for your records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Added" value={summary.added} tone="ok" />
              <Stat label="Updated" value={summary.updated} />
              <Stat label="Archived" value={summary.archived} />
              <Stat
                label="Errors"
                value={summary.errors.length}
                tone={summary.errors.length > 0 ? "danger" : "ok"}
              />
            </div>
            {summary.gradesCreated > 0 || summary.classesCreated > 0 ? (
              <p className="text-muted-foreground text-sm">
                Created {summary.gradesCreated} grade level(s) and{" "}
                {summary.classesCreated} class(es).
              </p>
            ) : null}
            {summary.errors.length > 0 ? (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-3 text-sm">
                {summary.errors.map((e, i) => (
                  <p key={`${e.rowNumber}-${i}`} className="text-destructive">
                    {e.rowNumber > 0 ? `Row ${e.rowNumber}: ` : ""}
                    {e.message}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={`/dashboard/${dashboardRole}/students`}>View students</Link>
              </Button>
              <Button type="button" variant="outline" onClick={downloadImportReport}>
                <Download className="size-4" />
                Download import report
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFileMeta(null);
                  setMapping({});
                  setPlan(null);
                  setSummary(null);
                  setError(null);
                  setStep("upload");
                }}
              >
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "danger";
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "ok" && "text-emerald-700 dark:text-emerald-300",
          tone === "danger" && value > 0 && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function OptionCheck({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border px-3 py-2.5">
      <input
        id={id}
        type="checkbox"
        className="border-input text-primary mt-1 size-4 shrink-0 rounded"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </Label>
        <p className="text-muted-foreground text-xs leading-snug">{description}</p>
      </div>
    </div>
  );
}
