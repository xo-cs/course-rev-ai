import type { Metadata } from "next";
import Link from "next/link";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Calendar</h1>
          <p className="mt-2 text-[15px] text-neutral-600">Your week. Dashed blocks are previews of sections you&apos;re looking at.</p>
        </div>
        <Link href="/courses" className="inline-flex h-11 items-center rounded-full border border-black px-5 text-sm font-semibold hover:bg-neutral-100">
          My Courses
        </Link>
      </header>
      <WeekCalendar />
    </div>
  );
}
