"use client";

// The student's semester plan, stored in localStorage. One section per course.
import { createLocalStore } from "./localStore";
import type { Scheduled } from "./schedule";
import type { Course, Section } from "./types";

export interface MyCourse extends Scheduled {
  professor: string;
  room: string;
  scheduleText: string;
  credits: number | null;
  addedAt: string;
}

const store = createLocalStore<MyCourse[]>("crai.mycourses.v1", []);

export function toMyCourse(course: Pick<Course, "id" | "name" | "credits">, s: Section): MyCourse {
  return {
    courseId: course.id,
    name: course.name,
    section: s.section,
    slots: s.slots,
    professor: s.professor,
    room: s.room,
    scheduleText: s.schedule_text,
    credits: course.credits,
    addedAt: new Date().toISOString(),
  };
}

export const myCoursesStore = {
  useAll: () => store.useValue(),
  getAll: () => store.get(),
  /** Adds the section, replacing another section of the same course if present. */
  add(entry: MyCourse) {
    store.set((list) => [...list.filter((c) => c.courseId !== entry.courseId), entry]);
  },
  remove(courseId: string) {
    store.set((list) => list.filter((c) => c.courseId !== courseId));
  },
  totalCredits: (list: MyCourse[]) => list.reduce((s, c) => s + (c.credits ?? 0), 0),
};
