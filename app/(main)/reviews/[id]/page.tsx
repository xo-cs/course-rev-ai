import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseDetail } from "@/components/course/CourseDetail";
import { courses, getCourse, getSeedReviews, programs } from "@/lib/catalog";
import { decodeId } from "@/lib/courseUtils";

export function generateStaticParams() {
  return courses.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/reviews/[id]">): Promise<Metadata> {
  const course = getCourse(decodeId((await params).id));
  return { title: course?.name ?? "Course not found" };
}

export default async function CoursePage({ params }: PageProps<"/reviews/[id]">) {
  const course = getCourse(decodeId((await params).id));
  if (!course) notFound();
  return <CourseDetail course={course} seedReviews={getSeedReviews(course.id)} programs={programs} />;
}
