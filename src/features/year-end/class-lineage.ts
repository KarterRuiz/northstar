import { isTerminalPrimaryGrade } from "./grade-ladder";
import type { ClassRef, GradeLevelRef } from "./types";

/**
 * Program/stream is not a first-class column on classes or grade_levels.
 * We infer it from grade name + class name prefixes (modeling weakness).
 */
export type ClassProgramKey =
  | "experimental"
  | "international"
  | "standard"
  | "unknown";

export type ClassLineageToken = {
  program: ClassProgramKey;
  /** Numeric grade embedded in the class name when detectable. */
  nameGrade: number | null;
  /** Trailing section token (e.g. "1", "A", "2") when detectable. */
  sectionToken: string | null;
  /** Stable key for 1:1 lineage matching within a program. */
  lineageKey: string;
};

const ECG_NAME_RE = /^(ECG)\s*(\d)\s*[-–—]?\s*([A-Za-z0-9]+)\s*$/i;
const LABELED_SECTION_RE =
  /^(International|Int\.?|Experimental|Exp\.?)\s*(\d)\s*([A-Za-z0-9]+)\s*$/i;
const BARE_GRADE_SECTION_RE = /^(\d)\s*([A-Za-z][A-Za-z0-9]*)\s*$/i;

export function inferProgramFromText(
  ...parts: Array<string | null | undefined>
): ClassProgramKey {
  const hay = parts
    .map((p) => (p ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  if (!hay) return "unknown";
  if (/\b(experimental|exp\.?|ecg)\b/.test(hay)) return "experimental";
  if (/\b(international|int\.?)\b/.test(hay)) return "international";
  return "standard";
}

export function parseClassLineage(
  classOrName: Pick<ClassRef, "name" | "section"> | string,
  gradeName?: string | null,
): ClassLineageToken {
  const name =
    typeof classOrName === "string" ? classOrName.trim() : classOrName.name.trim();
  const section =
    typeof classOrName === "string"
      ? null
      : (classOrName.section ?? "").trim() || null;

  const program = inferProgramFromText(name, section, gradeName);

  let nameGrade: number | null = null;
  let sectionToken: string | null = section;

  const ecg = name.match(ECG_NAME_RE);
  if (ecg) {
    nameGrade = Number.parseInt(ecg[2]!, 10);
    sectionToken = ecg[3]!.toUpperCase();
  } else {
    const labeled = name.match(LABELED_SECTION_RE);
    if (labeled) {
      nameGrade = Number.parseInt(labeled[2]!, 10);
      sectionToken = labeled[3]!.toUpperCase();
    } else {
      const bare = name.match(BARE_GRADE_SECTION_RE);
      if (bare) {
        nameGrade = Number.parseInt(bare[1]!, 10);
        sectionToken = bare[2]!.toUpperCase();
      }
    }
  }

  const lineageKey = `${program}::${(sectionToken ?? section ?? name)
    .trim()
    .toLowerCase()}`;

  return { program, nameGrade, sectionToken, lineageKey };
}

/**
 * Bump embedded grade digits in a class name for next-grade shells.
 * Returns null when the name has no unambiguous grade token to rewrite
 * (caller should keep the original name and rely on grade_level_id).
 */
export function bumpClassNameForNextGrade(
  name: string,
  fromGradeNum: number | null,
  toGradeNum: number,
): { name: string; confident: boolean } {
  const trimmed = name.trim();
  if (!trimmed) return { name: trimmed, confident: false };

  const ecg = trimmed.match(ECG_NAME_RE);
  if (ecg) {
    const from = Number.parseInt(ecg[2]!, 10);
    if (fromGradeNum != null && from !== fromGradeNum) {
      return { name: trimmed, confident: false };
    }
    return {
      name: `${ecg[1]!.toUpperCase()}${toGradeNum}-${ecg[3]!.toUpperCase()}`,
      confident: true,
    };
  }

  const labeled = trimmed.match(LABELED_SECTION_RE);
  if (labeled) {
    const from = Number.parseInt(labeled[2]!, 10);
    if (fromGradeNum != null && from !== fromGradeNum) {
      return { name: trimmed, confident: false };
    }
    const label = normalizeProgramLabel(labeled[1]!);
    return {
      name: `${label} ${toGradeNum}${labeled[3]!.toUpperCase()}`,
      confident: true,
    };
  }

  const bare = trimmed.match(BARE_GRADE_SECTION_RE);
  if (bare) {
    const from = Number.parseInt(bare[1]!, 10);
    if (fromGradeNum != null && from !== fromGradeNum) {
      return { name: trimmed, confident: false };
    }
    return {
      name: `${toGradeNum}${bare[2]!.toUpperCase()}`,
      confident: true,
    };
  }

  // Fallback: replace first whole-number grade token matching fromGradeNum.
  if (fromGradeNum != null) {
    const re = new RegExp(`(?<!\\d)${fromGradeNum}(?!\\d)`);
    if (re.test(trimmed)) {
      return {
        name: trimmed.replace(re, String(toGradeNum)),
        confident: true,
      };
    }
  }

  return { name: trimmed, confident: false };
}

function normalizeProgramLabel(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t.startsWith("exp")) return "Experimental";
  if (t.startsWith("int")) return "International";
  return raw.trim();
}

export function gradeNumberFromLevel(grade: GradeLevelRef): number | null {
  const code = (grade.code ?? "").trim().toUpperCase();
  const codeMatch = code.match(/^G(\d+)$/i);
  if (codeMatch) return Number.parseInt(codeMatch[1]!, 10);

  const name = grade.name.trim();
  const nameMatch = name.match(/(?:grade|year|g)\s*(\d+)/i) ?? name.match(/^(\d+)$/);
  if (nameMatch) return Number.parseInt(nameMatch[1]!, 10);
  return null;
}

/**
 * Prefer next grade in the same inferred program/stream when parallel
 * grade_levels share sort_order (Experimental vs standard).
 */
export function findNextGradeLevelForClass(args: {
  current: GradeLevelRef;
  all: readonly GradeLevelRef[];
  sourceClassName?: string | null;
  sourceSection?: string | null;
}): GradeLevelRef | null {
  const { current, all } = args;
  if (isTerminalPrimaryGrade(current)) return null;

  const sourceProgram = inferProgramFromText(
    args.sourceClassName,
    args.sourceSection,
    current.name,
  );

  const live = all
    .filter((g) => !g.is_archived)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const higher = live.filter((g) => g.sort_order > current.sort_order);
  if (higher.length === 0) return null;

  const minSort = higher[0]!.sort_order;
  const sameBucket = higher.filter((g) => g.sort_order === minSort);

  if (sameBucket.length === 1) return sameBucket[0]!;

  const currentNum = gradeNumberFromLevel(current);
  const wantNum = currentNum != null ? currentNum + 1 : null;

  const programMatched = sameBucket.filter(
    (g) => inferProgramFromText(g.name) === sourceProgram,
  );
  if (programMatched.length === 1) return programMatched[0]!;
  if (programMatched.length > 1 && wantNum != null) {
    const byNum = programMatched.find((g) => gradeNumberFromLevel(g) === wantNum);
    if (byNum) return byNum;
  }

  if (wantNum != null) {
    const wantCode = `G${wantNum}`;
    const byCode = sameBucket.find(
      (g) => (g.code ?? "").trim().toUpperCase() === wantCode,
    );
    if (byCode && inferProgramFromText(byCode.name) === sourceProgram) return byCode;
    if (byCode && sourceProgram === "standard") return byCode;
  }

  return programMatched[0] ?? sameBucket[0] ?? null;
}

export type NextYearShellProposal = {
  sourceClassId: string;
  targetGradeLevelId: string;
  name: string;
  section: string | null;
  namingConfident: boolean;
  program: ClassProgramKey;
  skippedReason?: "terminal_grade" | "no_next_grade";
};

/**
 * Cohort-driven next-grade shell proposals: one shell per source class
 * below terminal Primary, named from the source (not from existing dest counts).
 */
export function proposeNextGradeShells(args: {
  sourceClasses: readonly ClassRef[];
  gradesById: ReadonlyMap<string, GradeLevelRef>;
  allGrades: readonly GradeLevelRef[];
}): NextYearShellProposal[] {
  const out: NextYearShellProposal[] = [];

  for (const source of args.sourceClasses) {
    if (!source.is_active) continue;
    const sourceGrade = args.gradesById.get(source.grade_level_id);
    if (!sourceGrade) continue;

    const next = findNextGradeLevelForClass({
      current: sourceGrade,
      all: args.allGrades,
      sourceClassName: source.name,
      sourceSection: source.section,
    });

    const program = inferProgramFromText(
      source.name,
      source.section,
      sourceGrade.name,
    );

    if (!next) {
      out.push({
        sourceClassId: source.id,
        targetGradeLevelId: source.grade_level_id,
        name: source.name,
        section: source.section,
        namingConfident: false,
        program,
        skippedReason: isTerminalPrimaryGrade(sourceGrade)
          ? "terminal_grade"
          : "no_next_grade",
      });
      continue;
    }

    const fromNum = gradeNumberFromLevel(sourceGrade);
    const toNum = gradeNumberFromLevel(next) ?? (fromNum != null ? fromNum + 1 : null);
    const bumped =
      toNum != null
        ? bumpClassNameForNextGrade(source.name, fromNum, toNum)
        : { name: source.name, confident: false };

    out.push({
      sourceClassId: source.id,
      targetGradeLevelId: next.id,
      name: bumped.name,
      section: source.section,
      namingConfident: bumped.confident,
      program,
    });
  }

  return out;
}

export type CapacityCheckRow = {
  key: string;
  destinationGradeId: string;
  destinationGradeName: string;
  program: ClassProgramKey;
  programLabel: string;
  sourceCount: number;
  destinationShellCount: number;
  deficit: number;
};

function programLabel(program: ClassProgramKey): string {
  switch (program) {
    case "experimental":
      return "Experimental";
    case "international":
      return "International";
    case "standard":
      return "Standard";
    default:
      return "Other";
  }
}

/** Source cohort size vs destination shells for each next-grade/program bucket. */
export function summarizeCohortCapacity(args: {
  sourceClasses: readonly ClassRef[];
  destinationClasses: readonly ClassRef[];
  gradesById: ReadonlyMap<string, GradeLevelRef>;
  allGrades: readonly GradeLevelRef[];
}): CapacityCheckRow[] {
  const proposals = proposeNextGradeShells({
    sourceClasses: args.sourceClasses,
    gradesById: args.gradesById,
    allGrades: args.allGrades,
  }).filter((p) => !p.skippedReason);

  const sourceBuckets = new Map<
    string,
    { gradeId: string; gradeName: string; program: ClassProgramKey; count: number }
  >();

  for (const p of proposals) {
    const g = args.gradesById.get(p.targetGradeLevelId);
    const key = `${p.targetGradeLevelId}::${p.program}`;
    const prev = sourceBuckets.get(key);
    if (prev) prev.count += 1;
    else {
      sourceBuckets.set(key, {
        gradeId: p.targetGradeLevelId,
        gradeName: g?.name ?? "Grade",
        program: p.program,
        count: 1,
      });
    }
  }

  const destBuckets = new Map<string, number>();
  for (const c of args.destinationClasses) {
    if (!c.is_active) continue;
    const g = args.gradesById.get(c.grade_level_id);
    const program = inferProgramFromText(c.name, c.section, g?.name);
    const key = `${c.grade_level_id}::${program}`;
    destBuckets.set(key, (destBuckets.get(key) ?? 0) + 1);
  }

  const rows: CapacityCheckRow[] = [];
  for (const [key, bucket] of sourceBuckets) {
    const destCount = destBuckets.get(key) ?? 0;
    rows.push({
      key,
      destinationGradeId: bucket.gradeId,
      destinationGradeName: bucket.gradeName,
      program: bucket.program,
      programLabel: programLabel(bucket.program),
      sourceCount: bucket.count,
      destinationShellCount: destCount,
      deficit: Math.max(0, bucket.count - destCount),
    });
  }

  rows.sort(
    (a, b) =>
      a.destinationGradeName.localeCompare(b.destinationGradeName) ||
      a.programLabel.localeCompare(b.programLabel),
  );
  return rows;
}

export type ClassMapSuggestion = {
  fromClassId: string;
  toClassId: string;
  reason: "lineage_name" | "lineage_section" | "exact_name";
};

/**
 * Deterministic 1:1 lineage suggestions. Each destination used at most once
 * so collisions surface as unmapped rather than silent multi-maps.
 */
export function suggestLineageClassMaps(args: {
  sourceClasses: readonly ClassRef[];
  destinationClasses: readonly ClassRef[];
  gradesById: ReadonlyMap<string, GradeLevelRef>;
  allGrades: readonly GradeLevelRef[];
}): ClassMapSuggestion[] {
  const proposals = proposeNextGradeShells({
    sourceClasses: args.sourceClasses,
    gradesById: args.gradesById,
    allGrades: args.allGrades,
  });

  const usedDest = new Set<string>();
  const suggestions: ClassMapSuggestion[] = [];
  const activeDest = args.destinationClasses.filter((c) => c.is_active);

  for (const source of args.sourceClasses) {
    if (!source.is_active) continue;
    const proposal = proposals.find((p) => p.sourceClassId === source.id);
    if (!proposal || proposal.skippedReason) continue;

    const candidates = activeDest.filter(
      (c) => c.grade_level_id === proposal.targetGradeLevelId && !usedDest.has(c.id),
    );
    if (candidates.length === 0) continue;

    const sourceGrade = args.gradesById.get(source.grade_level_id);
    const sourceLin = parseClassLineage(source, sourceGrade?.name);
    const wantName = proposal.name.trim().toLowerCase();

    const byName = candidates.find((c) => c.name.trim().toLowerCase() === wantName);
    if (byName) {
      usedDest.add(byName.id);
      suggestions.push({
        fromClassId: source.id,
        toClassId: byName.id,
        reason: "lineage_name",
      });
      continue;
    }

    const byLineage = candidates.find((c) => {
      const destGrade = args.gradesById.get(c.grade_level_id);
      const destLin = parseClassLineage(c, destGrade?.name);
      return (
        destLin.program === sourceLin.program &&
        destLin.sectionToken != null &&
        destLin.sectionToken === sourceLin.sectionToken
      );
    });
    if (byLineage) {
      usedDest.add(byLineage.id);
      suggestions.push({
        fromClassId: source.id,
        toClassId: byLineage.id,
        reason: "lineage_section",
      });
      continue;
    }

    const sourceSection = (source.section ?? "").trim().toLowerCase();
    if (sourceSection) {
      const bySection = candidates.filter(
        (c) => (c.section ?? "").trim().toLowerCase() === sourceSection,
      );
      if (bySection.length === 1) {
        const only = bySection[0]!;
        const destGrade = args.gradesById.get(only.grade_level_id);
        if (
          inferProgramFromText(only.name, only.section, destGrade?.name) ===
          sourceLin.program
        ) {
          usedDest.add(only.id);
          suggestions.push({
            fromClassId: source.id,
            toClassId: only.id,
            reason: "exact_name",
          });
        }
      }
    }
  }

  return suggestions;
}

export type MergeGroup = {
  toClassId: string;
  toClassLabel: string;
  fromClassIds: string[];
  fromClassLabels: string[];
};

/** Intentional multi-source → one destination groups (not an error). */
export function collectIntentionalMerges(args: {
  maps: readonly { fromClassId: string; toClassId: string | null }[];
  fromLabelById: ReadonlyMap<string, string>;
  toLabelById: ReadonlyMap<string, string>;
}): MergeGroup[] {
  const byDest = new Map<string, string[]>();
  for (const m of args.maps) {
    if (!m.toClassId) continue;
    const list = byDest.get(m.toClassId) ?? [];
    list.push(m.fromClassId);
    byDest.set(m.toClassId, list);
  }

  const groups: MergeGroup[] = [];
  for (const [toClassId, fromClassIds] of byDest) {
    if (fromClassIds.length < 2) continue;
    groups.push({
      toClassId,
      toClassLabel: args.toLabelById.get(toClassId) ?? toClassId,
      fromClassIds,
      fromClassLabels: fromClassIds.map(
        (id) => args.fromLabelById.get(id) ?? id,
      ),
    });
  }
  groups.sort((a, b) => a.toClassLabel.localeCompare(b.toClassLabel));
  return groups;
}

export type SuggestedNewShell = {
  gradeLevelId: string;
  gradeName: string;
  program: ClassProgramKey;
  programLabel: string;
  suggestedName: string | null;
  suggestedSection: string | null;
  namingAmbiguous: boolean;
};

/**
 * Suggest the next free shell name for a destination grade/program bucket.
 * Returns namingAmbiguous when patterns are mixed / unclear.
 */
export function suggestNextShellInBucket(args: {
  grade: GradeLevelRef;
  program: ClassProgramKey;
  existingInBucket: readonly ClassRef[];
}): SuggestedNewShell {
  const gradeNum = gradeNumberFromLevel(args.grade);
  const existing = args.existingInBucket.filter((c) => c.is_active);
  const programLabelText = programLabel(args.program);

  if (args.program === "experimental" && gradeNum != null) {
    const used = new Set<number>();
    let patternOk = existing.length === 0;
    for (const c of existing) {
      const m = c.name.trim().match(ECG_NAME_RE);
      if (m && Number.parseInt(m[2]!, 10) === gradeNum) {
        const n = Number.parseInt(m[3]!, 10);
        if (Number.isFinite(n)) used.add(n);
        patternOk = true;
      } else if (existing.length > 0) {
        // Non-ECG name in Experimental bucket → ambiguous if we can't parse any.
      }
    }
    if (patternOk || existing.every((c) => ECG_NAME_RE.test(c.name.trim()))) {
      let next = 1;
      while (used.has(next)) next += 1;
      return {
        gradeLevelId: args.grade.id,
        gradeName: args.grade.name,
        program: args.program,
        programLabel: programLabelText,
        suggestedName: `ECG${gradeNum}-${next}`,
        suggestedSection: String(next),
        namingAmbiguous: false,
      };
    }
  }

  if (args.program === "international" && gradeNum != null) {
    const usedLetters = new Set<string>();
    let parsed = 0;
    for (const c of existing) {
      const lin = parseClassLineage(c, args.grade.name);
      if (lin.sectionToken && /^[A-Z]$/i.test(lin.sectionToken)) {
        usedLetters.add(lin.sectionToken.toUpperCase());
        parsed += 1;
      }
    }
    if (existing.length === 0 || parsed === existing.length) {
      let code = "A".charCodeAt(0);
      while (usedLetters.has(String.fromCharCode(code))) code += 1;
      if (code <= "Z".charCodeAt(0)) {
        const letter = String.fromCharCode(code);
        return {
          gradeLevelId: args.grade.id,
          gradeName: args.grade.name,
          program: args.program,
          programLabel: programLabelText,
          suggestedName: `International ${gradeNum}${letter}`,
          suggestedSection: letter,
          namingAmbiguous: false,
        };
      }
    }
  }

  // Numeric section fallback (ECG-like or bare).
  const usedNums = new Set<number>();
  let numericOk = 0;
  for (const c of existing) {
    const lin = parseClassLineage(c, args.grade.name);
    const n = Number.parseInt(lin.sectionToken ?? "", 10);
    if (Number.isFinite(n)) {
      usedNums.add(n);
      numericOk += 1;
    }
  }
  if (gradeNum != null && (existing.length === 0 || numericOk === existing.length)) {
    let next = 1;
    while (usedNums.has(next)) next += 1;
    if (args.program === "experimental") {
      return {
        gradeLevelId: args.grade.id,
        gradeName: args.grade.name,
        program: args.program,
        programLabel: programLabelText,
        suggestedName: `ECG${gradeNum}-${next}`,
        suggestedSection: String(next),
        namingAmbiguous: false,
      };
    }
    return {
      gradeLevelId: args.grade.id,
      gradeName: args.grade.name,
      program: args.program,
      programLabel: programLabelText,
      suggestedName: `${gradeNum}${next}`,
      suggestedSection: String(next),
      namingAmbiguous: existing.length > 0 && numericOk < existing.length,
    };
  }

  return {
    gradeLevelId: args.grade.id,
    gradeName: args.grade.name,
    program: args.program,
    programLabel: programLabelText,
    suggestedName: null,
    suggestedSection: null,
    namingAmbiguous: true,
  };
}

export function classStructureKey(
  gradeLevelId: string,
  name: string,
  section: string | null | undefined,
): string {
  return `${gradeLevelId}::${name.trim().toLowerCase()}::${(section ?? "")
    .trim()
    .toLowerCase()}`;
}
