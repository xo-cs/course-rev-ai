"use client";

import { useId, useRef, useState } from "react";
import { ProfileFields } from "@/components/shell/ProfileModal";
import { Modal } from "@/components/ui/Modal";
import { profileStore } from "@/lib/profileStore";
import { cleanProfessor, reviewerMeta } from "@/lib/reviewDisplay";
import { reviewsStore, type ReviewInput } from "@/lib/reviewsStore";
import { ALL_TAGS, MAX_REVIEW_CHARS, MAX_TAGS, MIN_REVIEW_CHARS, SEMESTERS } from "@/lib/tags";
import { showToast } from "@/lib/toast";
import type { Profile, Review } from "@/lib/types";

export interface ReviewFormCourse {
  id: string;
  name: string;
  sections: { section: string; professor: string }[];
}

/** Hook point for AI moderation (Phase 3). Returns the moderation status to store. */
export type ModerateFn = (input: ReviewInput) => Promise<
  { status: "ok" | "pending" } | { status: "blocked"; reason: string; suggestion: string }
>;

const allowAll: ModerateFn = async () => ({ status: "ok" });

export function ReviewFormModal({
  course,
  programs,
  open,
  onClose,
  moderate = allowAll,
}: {
  course: ReviewFormCourse;
  programs: string[];
  open: boolean;
  onClose: () => void;
  moderate?: ModerateFn;
}) {
  const formId = useId();
  const existing = open ? reviewsStore.mine(course.id) : undefined;
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? `Edit your review` : `Rate ${course.name}`}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-full px-5 text-[15px] font-medium hover:bg-neutral-100">
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={busy}
            className="h-11 flex-1 rounded-full bg-black px-6 text-[15px] font-medium text-white hover:bg-neutral-800 disabled:opacity-60 sm:flex-none"
          >
            {busy ? "Checking…" : existing ? "Save changes" : "Post review"}
          </button>
        </div>
      }
    >
      {open && (
        <ReviewForm
          formId={formId}
          course={course}
          programs={programs}
          existing={existing}
          moderate={moderate}
          setBusy={setBusy}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

type Errors = Partial<Record<"name" | "rating" | "difficulty" | "workload" | "wouldRecommend" | "semester" | "text" | "tag", string>>;

function ReviewForm({
  formId,
  course,
  programs,
  existing,
  moderate,
  setBusy,
  onDone,
}: {
  formId: string;
  course: ReviewFormCourse;
  programs: string[];
  existing?: Review;
  moderate: ModerateFn;
  setBusy: (b: boolean) => void;
  onDone: () => void;
}) {
  const [identity, setIdentity] = useState<Profile>(() => profileStore.get());
  const [editIdentity, setEditIdentity] = useState(() => !profileStore.get().name);
  const [anonymous, setAnonymous] = useState(existing?.anonymous ?? false);
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [difficulty, setDifficulty] = useState<number | null>(existing?.difficulty ?? null);
  const [workload, setWorkload] = useState<number | null>(existing?.workload ?? null);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(existing?.wouldRecommend ?? null);
  const [section, setSection] = useState(existing?.section ?? "");
  const [professor, setProfessor] = useState(existing?.professor ?? "");
  const [semester, setSemester] = useState(existing?.semester ?? "");
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [customTag, setCustomTag] = useState("");
  const [text, setText] = useState(existing?.text ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [blocked, setBlocked] = useState<{ reason: string; suggestion: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const professors = [...new Set(course.sections.map((s) => s.professor.trim()).filter((p) => cleanProfessor(p)))];
  const clear = (k: keyof Errors) => setErrors((e) => ({ ...e, [k]: undefined }));

  const toggleTag = (t: string) => {
    clear("tag");
    setTags((list) => (list.includes(t) ? list.filter((x) => x !== t) : list.length >= MAX_TAGS ? list : [...list, t]));
  };

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase().replace(/\s+/g, " ");
    if (!t) return;
    if (t.length > 24) return setErrors((e) => ({ ...e, tag: "Keep tags under 24 characters." }));
    if (tags.length >= MAX_TAGS) return setErrors((e) => ({ ...e, tag: `Up to ${MAX_TAGS} tags.` }));
    if (!tags.includes(t)) setTags([...tags, t]);
    setCustomTag("");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    const name = identity.name?.trim() ?? "";
    const errs: Errors = {};
    if (!name) errs.name = "Enter your name to post (demo sign in).";
    if (!rating) errs.rating = "Rate the overall quality.";
    if (!difficulty) errs.difficulty = "Rate the difficulty.";
    if (!workload) errs.workload = "Rate the workload.";
    if (wouldRecommend === null) errs.wouldRecommend = "Choose yes or no.";
    if (!semester) errs.semester = "Pick the semester you took it.";
    if (trimmed.length < MIN_REVIEW_CHARS) errs.text = `Write at least ${MIN_REVIEW_CHARS} characters (${trimmed.length} so far).`;
    setErrors(errs);
    if (Object.keys(errs).length) {
      if (errs.name) setEditIdentity(true);
      // Move focus to the first problem so keyboard and screen reader users find it.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }

    // Demo sign in: save the identity used for this review.
    const profile = { ...identity, name };
    profileStore.set(profile);

    const input: ReviewInput = {
      courseId: course.id,
      reviewer: { name, year: profile.year, program: profile.program },
      anonymous,
      professor: professor || "Not sure",
      section: section || undefined,
      semester,
      rating: rating!,
      difficulty: difficulty!,
      workload: workload!,
      wouldRecommend: wouldRecommend!,
      tags,
      text: trimmed.slice(0, MAX_REVIEW_CHARS),
    };

    setBusy(true);
    const verdict = await moderate(input).catch(() => ({ status: "pending" as const }));
    setBusy(false);
    if (verdict.status === "blocked") {
      setBlocked({ reason: verdict.reason, suggestion: verdict.suggestion });
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("#moderation-note")?.focus());
      return;
    }
    reviewsStore.save(input, verdict.status);
    onDone();
    showToast(
      verdict.status === "pending"
        ? "Posted. It will be double-checked shortly."
        : existing
          ? "Your review is updated."
          : "Thanks! Your review is posted.",
    );
  }

  return (
    <form id={formId} ref={formRef} onSubmit={submit} noValidate className="space-y-6">
      {blocked && (
        <div id="moderation-note" tabIndex={-1} role="alert" className="rounded-xl border-2 border-black p-4 outline-none">
          <p className="text-[15px] font-semibold">This review can&apos;t be posted yet</p>
          <p className="mt-1 text-sm text-neutral-700">{blocked.reason}</p>
          {blocked.suggestion && (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.06em] text-neutral-500">Suggested rewrite</p>
              <p className="mt-1 rounded-lg bg-neutral-100 p-3 text-sm leading-relaxed">{blocked.suggestion}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setText(blocked.suggestion);
                    setBlocked(null);
                  }}
                  className="h-11 rounded-full bg-black px-4 text-sm font-semibold text-white"
                >
                  Use this text
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setText(blocked.suggestion);
                    setBlocked(null);
                    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("textarea")?.focus());
                  }}
                  className="h-11 rounded-full border border-black px-4 text-sm font-semibold"
                >
                  Edit it first
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Identity */}
      <section aria-label="Who is posting" className="rounded-xl border border-neutral-200 p-4">
        {editIdentity ? (
          <>
            <p className="mb-3 text-sm text-neutral-600">
              <strong className="text-black">Demo sign in.</strong> No password, stored in this browser.
            </p>
            <ProfileFields draft={identity} setDraft={(p) => { setIdentity(p); clear("name"); }} programs={programs} nameError={errors.name} />
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-[15px]">
              <span className="text-neutral-500">Posting as </span>
              <strong>{identity.name}</strong>
              {reviewerMeta({ reviewer: { name: identity.name, year: identity.year, program: identity.program } }) && (
                <span className="text-neutral-500">
                  {" "}
                  · {reviewerMeta({ reviewer: { name: identity.name, year: identity.year, program: identity.program } })}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setEditIdentity(true)}
              className="h-11 shrink-0 rounded-full px-3 text-sm underline underline-offset-4 hover:no-underline"
            >
              Change
            </button>
          </div>
        )}

        <fieldset className="mt-4">
          <legend className="mb-2 text-[15px] font-semibold">Show my review</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Show my review">
            <IdentityOption on={!anonymous} onClick={() => setAnonymous(false)} title="Post with my name">
              Students see {identity.name?.trim() || "your name"}.
            </IdentityOption>
            <IdentityOption on={anonymous} onClick={() => setAnonymous(true)} title="Post anonymously">
              Hidden from other students. The university can still see who wrote it, to prevent abuse.
            </IdentityOption>
          </div>
        </fieldset>
      </section>

      <Scale label="Quality" low="Awful" high="Awesome" value={rating} onChange={(v) => { setRating(v); clear("rating"); }} error={errors.rating} />
      <Scale label="Difficulty" low="Very easy" high="Very hard" value={difficulty} onChange={(v) => { setDifficulty(v); clear("difficulty"); }} error={errors.difficulty} />
      <Scale label="Workload" low="Very light" high="Very heavy" value={workload} onChange={(v) => { setWorkload(v); clear("workload"); }} error={errors.workload} />

      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Would take again</legend>
        <div className="grid max-w-xs grid-cols-2 gap-2" role="radiogroup" aria-label="Would take again">
          {([
            [true, "Yes"],
            [false, "No"],
          ] as const).map(([v, label], i) => {
            const on = wouldRecommend === v;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={on}
                aria-invalid={i === 0 && errors.wouldRecommend ? true : undefined}
                onClick={() => { setWouldRecommend(v); clear("wouldRecommend"); }}
                className={`h-11 rounded-xl border text-[15px] font-medium transition-colors ${
                  on ? "border-black bg-black text-white" : "border-neutral-300 hover:border-black"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <FieldError msg={errors.wouldRecommend} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">Section</span>
          <select
            value={section}
            onChange={(e) => {
              setSection(e.target.value);
              const p = course.sections.find((s) => s.section === e.target.value)?.professor.trim();
              if (p && cleanProfessor(p)) setProfessor(p);
            }}
            className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base hover:border-black"
          >
            <option value="">Not sure</option>
            {course.sections.map((s) => (
              <option key={s.section} value={s.section}>
                {s.section}
                {cleanProfessor(s.professor) ? ` · ${cleanProfessor(s.professor)}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">Professor</span>
          <select
            value={professor}
            onChange={(e) => setProfessor(e.target.value)}
            className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base hover:border-black"
          >
            <option value="">Not sure</option>
            {professors.map((p) => (
              <option key={p} value={p}>
                {cleanProfessor(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">Semester taken</span>
          <select
            value={semester}
            onChange={(e) => { setSemester(e.target.value); clear("semester"); }}
            aria-invalid={errors.semester ? true : undefined}
            className={`h-12 w-full rounded-xl border bg-white px-3 text-base hover:border-black ${
              errors.semester ? "border-black ring-2 ring-black" : "border-neutral-300"
            }`}
          >
            <option value="">Choose…</option>
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <FieldError msg={errors.semester} />
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">
          Tags <span className="font-normal text-neutral-500">(up to {MAX_TAGS})</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {[...ALL_TAGS, ...tags.filter((t) => !ALL_TAGS.includes(t))].map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(t)}
                disabled={!on && tags.length >= MAX_TAGS}
                className={`h-10 rounded-full border px-3.5 text-sm transition-colors disabled:opacity-40 ${
                  on ? "border-black bg-black text-white" : "border-neutral-300 hover:border-black"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomTag();
              }
            }}
            maxLength={30}
            placeholder="Add your own tag"
            aria-label="Custom tag"
            className="h-11 min-w-0 flex-1 rounded-xl border border-neutral-300 px-3 text-base hover:border-black"
          />
          <button type="button" onClick={addCustomTag} className="h-11 rounded-xl border border-black px-4 text-[15px] font-medium hover:bg-neutral-100">
            Add
          </button>
        </div>
        <FieldError msg={errors.tag} />
      </fieldset>

      <label className="block">
        <span className="mb-1.5 flex items-baseline justify-between text-[15px] font-semibold">
          Your review
          <span className={`text-xs font-normal tabular-nums ${text.trim().length < MIN_REVIEW_CHARS ? "text-neutral-500" : "text-black"}`}>
            {text.trim().length}/{MAX_REVIEW_CHARS}
          </span>
        </span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (errors.text && e.target.value.trim().length >= MIN_REVIEW_CHARS) clear("text");
          }}
          maxLength={MAX_REVIEW_CHARS}
          rows={5}
          aria-invalid={errors.text ? true : undefined}
          placeholder="What was the teaching like? Exams, projects, workload, tips for future students…"
          className={`w-full resize-y rounded-xl border px-3 py-2.5 text-base leading-relaxed hover:border-black ${
            errors.text ? "border-black ring-2 ring-black" : "border-neutral-300"
          }`}
        />
        <FieldError msg={errors.text} />
        <p className="mt-1.5 text-xs text-neutral-500">
          Be fair and specific: no insults, personal attacks or private info. Reviews are checked by AI before posting.
        </p>
      </label>
    </form>
  );
}

function IdentityOption({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`flex gap-3 rounded-xl border p-3 text-left transition-colors ${on ? "border-black ring-1 ring-black" : "border-neutral-300 hover:border-black"}`}
    >
      <span aria-hidden className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-black" : "border-neutral-400"}`}>
        {on && <span className="size-2.5 rounded-full bg-black" />}
      </span>
      <span>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-neutral-600">{children}</span>
      </span>
    </button>
  );
}

function Scale({
  label,
  low,
  high,
  value,
  onChange,
  error,
}: {
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (v: number) => void;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[15px] font-semibold">{label}</legend>
      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={`${label}, 1 (${low}) to 5 (${high})`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          const filled = value != null && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${n}`}
              aria-invalid={n === 1 && error ? true : undefined}
              onClick={() => onChange(n)}
              className={`h-12 rounded-xl border text-base font-semibold tabular-nums transition-colors ${
                on ? "border-black bg-black text-white" : filled ? "border-black bg-neutral-200" : "border-neutral-300 hover:border-black"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-500">
        <span>{low}</span>
        <span>{high}</span>
      </div>
      <FieldError msg={error} />
    </fieldset>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium" role="alert">
      <span aria-hidden className="flex size-4 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
        !
      </span>
      {msg}
    </p>
  );
}
