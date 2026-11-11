import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewsBrowser, ReviewsBrowserSkeleton } from "@/components/reviews/ReviewsBrowser";
import { courses, programs, seedReviews, toListItem } from "@/lib/catalog";
import { totalsByCourse } from "@/lib/stats";

export const metadata: Metadata = { title: "Reviews" };

export default function ReviewsPage() {
  const items = courses.map(toListItem);
  const totals = totalsByCourse(seedReviews);
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Course reviews</h1>
        <p className="mt-2 text-[15px] text-neutral-600">
          {items.length} courses from the Spring 2025 timetable, rated by students.
        </p>
      </header>
      <Suspense fallback={<ReviewsBrowserSkeleton />}>
        <ReviewsBrowser courses={items} seedTotals={totals} programs={programs} />
      </Suspense>
    </div>
  );
}
