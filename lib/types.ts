export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface Slot {
  day: Day;
  start: string; // "HH:MM"
  end: string;
}

export interface Section {
  section: string;
  professor: string;
  room: string;
  schedule_text: string;
  slots: Slot[];
  block: string;
  remark: string;
  makeup: string;
}

export interface Course {
  id: string;
  name: string;
  name_original: string;
  program: string;
  program_code: string;
  department: string;
  target_years: number[];
  credits: number | null;
  hours: number | null;
  type: string;
  mode: string;
  course_code: string;
  track?: string;
  taught_in_korean?: boolean;
  professors: string[];
  sections: Section[];
}

export interface Reviewer {
  /** Real name. For anonymous reviews it is stripped before reaching students (see publicReview). */
  name: string | null;
  year: number | null;
  program: string | null;
}

/** ok = passed AI check, pending = AI check failed/unavailable, hidden = hidden by admin. */
export type ModerationStatus = "ok" | "pending" | "hidden";

export interface Review {
  id: string;
  courseId: string;
  reviewer: Reviewer;
  anonymous: boolean;
  /** Demo user id of the author (user-written reviews only). */
  authorId?: string;
  professor: string;
  section?: string;
  semester: string;
  rating: number; // "Quality"
  difficulty: number;
  workload: number;
  wouldRecommend: boolean; // "Would take again"
  tags: string[];
  text: string;
  createdAt: string; // YYYY-MM-DD
  updatedAt?: string;
  isSample?: boolean;
  moderation?: ModerationStatus;
}

export type TypeGroup = "Basic" | "Core" | "Advanced" | "Focus" | "Track" | "GE" | "Major" | "Other";

/** Running totals so we can merge seed + user reviews cheaply. */
export interface StatTotals {
  n: number;
  q: number;
  d: number;
  w: number;
}

/** Trimmed course shape sent to the client for the list page. */
export interface CourseListItem {
  id: string;
  name: string;
  program: string;
  years: number[];
  credits: number | null;
  type: string;
  typeGroup: TypeGroup;
  track: boolean;
  korean: boolean;
  professors: string[];
  days: Day[];
}

export interface Profile {
  /** "Demo sign in": a display name, no password. Needed to post reviews. */
  name: string | null;
  program: string | null;
  year: number | null;
  /** Graduation credits confirmed from a screenshot (Phase 6). */
  credits?: import("./credits").CreditsProgress | null;
}
