// Review tags. The positive/negative split is reused by the admin dashboard.
export const POSITIVE_TAGS = [
  "clear lectures",
  "inspiring",
  "fair grading",
  "easy A",
  "light workload",
  "hands-on labs",
  "practical skills",
  "accessible outside class",
];
export const NEGATIVE_TAGS = ["heavy on exams", "tough grader", "lots of homework", "lecture heavy", "unclear grading"];
export const NEUTRAL_TAGS = ["group projects", "presentations", "participation matters", "attendance matters", "lots of reading"];
export const ALL_TAGS = [...POSITIVE_TAGS, ...NEGATIVE_TAGS, ...NEUTRAL_TAGS];

export const SEMESTERS = ["2026 Fall", "2026 Spring", "2025 Fall", "2025 Spring", "2024 Fall", "2024 Spring", "2023 Fall"];

export const MAX_TAGS = 5;
export const MIN_REVIEW_CHARS = 30;
export const MAX_REVIEW_CHARS = 1200;
