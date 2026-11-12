// Graduation credits extracted from a screenshot and confirmed by the student.
import type { TypeGroup } from "./types";

export interface CreditCategory {
  name: string;
  required: number;
  earned: number;
}

export interface CreditsProgress {
  categories: CreditCategory[];
  confirmedAt: string;
}

export const remainingOf = (c: CreditCategory) => Math.max(0, c.required - c.earned);

export function totals(categories: CreditCategory[]) {
  const required = categories.reduce((s, c) => s + c.required, 0);
  const earned = categories.reduce((s, c) => s + Math.min(c.earned, c.required), 0);
  return { required, earned, remaining: categories.reduce((s, c) => s + remainingOf(c), 0) };
}

/**
 * Which category a course of this type would count toward (best guess from names).
 * Returns the category index, or -1 when no category fits.
 */
export function categoryFor(typeGroup: TypeGroup | undefined, categories: CreditCategory[]): number {
  const find = (re: RegExp) => categories.findIndex((c) => re.test(c.name));
  switch (typeGroup) {
    case "GE":
      return find(/general|교양|\bGE\b|liberal/i);
    case "Basic":
      return pick(find(/basic|기초/i), find(/major|전공/i));
    case "Core":
      return pick(find(/core|핵심/i), find(/major|전공/i));
    case "Advanced":
      return pick(find(/advanc|심화/i), find(/major|전공/i));
    case "Focus":
      return pick(find(/focus|중점/i), find(/major|전공/i));
    case "Major":
    case "Track":
      return pick(find(/major|전공/i), find(/elective|free|일반선택/i));
    default:
      return find(/elective|free|일반선택/i);
  }
}
const pick = (...ids: number[]) => ids.find((i) => i >= 0) ?? -1;
