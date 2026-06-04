import type { AssignmentForCalc, CategoryForCalc } from "./calculations";
import type {
  GradebookAssignmentRow,
  GradebookCategoryRow,
} from "./load-gradebook-data";

export function mapGradebookCategoriesForCalc(
  categories: GradebookCategoryRow[],
): CategoryForCalc[] {
  return categories.map((c) => ({
    id: c.id,
    weightPercent: c.weightPercent,
  }));
}

export function mapGradebookAssignmentsForCalc(
  assignments: GradebookAssignmentRow[],
): AssignmentForCalc[] {
  return assignments.map((a) => ({
    id: a.id,
    categoryId: a.categoryId,
    pointsPossible: a.pointsPossible,
    term: a.term,
  }));
}
