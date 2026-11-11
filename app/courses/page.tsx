import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = { title: "My Courses" };

export default function MyCoursesPage() {
  return <ComingSoon title="My Courses" text="Your semester plan will live here." />;
}
