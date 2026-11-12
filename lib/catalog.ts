// Server-side data access. Imports the JSON at build time; do not import from client components.
import coursesJson from "@/data/courses.json";
import reviewsJson from "@/data/reviews.json";
import { courseDays, typeGroup } from "./courseUtils";
import { isVisibleToStudents, publicReview } from "./reviewDisplay";
import type { Course, CourseListItem, Review } from "./types";

export const courses = coursesJson as unknown as Course[];
export const seedReviews = reviewsJson as Review[];

const byId = new Map(courses.map((c) => [c.id, c]));

export function getCourse(id: string) {
  return byId.get(id);
}

/** Student-facing seed reviews (anonymous names removed, hidden ones dropped). */
export function getSeedReviews(courseId: string) {
  return seedReviews.filter((r) => r.courseId === courseId && isVisibleToStudents(r)).map(publicReview);
}

/** Full seed reviews including anonymous reviewers' names. Admin only. */
export function getSeedReviewsForAdmin() {
  return seedReviews;
}

export const programs = [...new Set(courses.map((c) => c.program))].sort((a, b) => a.localeCompare(b));

export function toListItem(c: Course): CourseListItem {
  return {
    id: c.id,
    name: c.name,
    program: c.program,
    years: c.target_years,
    credits: c.credits,
    type: c.type,
    typeGroup: typeGroup(c.type),
    track: Boolean(c.track),
    korean: Boolean(c.taught_in_korean),
    professors: c.professors.filter(Boolean),
    days: courseDays(c),
  };
}

export interface CourseSections {
  name: string;
  credits: number | null;
  typeGroup: import("./types").TypeGroup;
  sections: { section: string; professor: string; room: string; schedule_text: string; slots: Course["sections"][number]["slots"]; remark: string }[];
}

/** Compact sections for every course (for section dropdowns on My Courses). */
export function sectionIndex(): Record<string, CourseSections> {
  return Object.fromEntries(
    courses.map((c) => [
      c.id,
      {
        name: c.name,
        credits: c.credits,
        typeGroup: typeGroup(c.type),
        sections: c.sections.map((s) => ({ section: s.section, professor: s.professor, room: s.room, schedule_text: s.schedule_text, slots: s.slots, remark: s.remark })),
      },
    ]),
  );
}
