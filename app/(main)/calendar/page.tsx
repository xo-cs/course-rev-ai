import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return <ComingSoon title="Calendar" text="Your weekly timetable will appear here once you add courses." />;
}
