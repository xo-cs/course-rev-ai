// Server-side data access. Imports the JSON at build time; do not import from client components.
import coursesJson from "@/data/courses.json";
import reviewsJson from "@/data/reviews.json";
import { courseDays, typeGroup } from "./courseUtils";
import type { Course, CourseListItem, Review } from "./types";

export const courses = coursesJson as unknown as Course[];
export const seedReviews = reviewsJson as Review[];

const byId = new Map(courses.map((c) => [c.id, c]));

export function getCourse(id: string) {
  return byId.get(id);
}

export function getSeedReviews(courseId: string) {
  return seedReviews.filter((r) => r.courseId === courseId);
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
