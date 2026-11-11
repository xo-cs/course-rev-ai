import { IconCalendar, IconCourses, IconReviews } from "@/components/ui/Icons";

export const NAV_ITEMS = [
  { href: "/reviews", label: "Reviews", Icon: IconReviews },
  { href: "/courses", label: "My Courses", Icon: IconCourses },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
] as const;
