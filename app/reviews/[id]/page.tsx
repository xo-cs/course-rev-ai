import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { courses, getCourse, getSeedReviews } from "@/lib/catalog";
import { decodeId, formatCredits, formatYears } from "@/lib/courseUtils";
import { IconChevronLeft } from "@/components/ui/Icons";
import { QualityBox } from "@/components/reviews/QualityBox";
import { avg } from "@/lib/stats";

export function generateStaticParams() {
  return courses.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/reviews/[id]">): Promise<Metadata> {
  const course = getCourse(decodeId((await params).id));
  return { title: course?.name ?? "Course not found" };
}

// Phase 1 placeholder: full detail page (sections, comments, review form) comes in Phase 2.
export default async function CoursePage({ params }: PageProps<"/reviews/[id]">) {
  const course = getCourse(decodeId((await params).id));
  if (!course) notFound();
  const reviews = getSeedReviews(course.id);
  const quality = avg(
    reviews.reduce((s, r) => s + r.rating, 0),
    reviews.length,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
      <Link href="/reviews" className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-black">
        <IconChevronLeft width={16} height={16} /> All courses
      </Link>
      <div className="mt-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{course.name}</h1>
          <p className="mt-2 text-lg text-neutral-600">{course.professors.join(", ") || "Professor TBA"}</p>
          <p className="mt-3 text-sm text-neutral-500">
            {course.program} · {formatYears(course.target_years)} · {formatCredits(course.credits)} · {course.type || "Other"}
          </p>
        </div>
        <QualityBox value={quality} count={reviews.length} />
      </div>
      <p className="mt-10 rounded-2xl border border-dashed border-neutral-300 px-6 py-10 text-center text-sm text-neutral-500">
        Sections, comments and the review form arrive in Phase 2.
      </p>
    </div>
  );
}
