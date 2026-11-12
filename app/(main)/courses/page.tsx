import type { Metadata } from "next";
import { MyCourses } from "@/components/courses/MyCourses";
import { programs, sectionIndex } from "@/lib/catalog";

export const metadata: Metadata = { title: "My Courses" };

export default function MyCoursesPage() {
  return <MyCourses index={sectionIndex()} programs={programs} />;
}
