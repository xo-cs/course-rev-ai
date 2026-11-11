"use client";

import { useId, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { reviewsStore } from "@/lib/reviewsStore";
import { ALL_TAGS, MAX_REVIEW_CHARS, MAX_TAGS, MIN_REVIEW_CHARS, SEMESTERS } from "@/lib/tags";
import { showToast } from "@/lib/toast";

export interface ReviewFormCourse {
  id: string;
  name: string;
  professors: string[]; // from the sections
}

export function ReviewFormModal({ course, open, onClose }: { course: ReviewFormCourse; open: boolean; onClose: () => void }) {
  const formId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Rate ${course.name}`}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-full px-5 text-[15px] font-medium hover:bg-neutral-100">
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            className="h-11 flex-1 rounded-full bg-black px-6 text-[15px] font-medium text-white hover:bg-neutral-800 sm:flex-none"
          >
            Post review
          </button>
        </div>
      }
    >
      {open && <ReviewForm formId={formId} course={course} onDone={onClose} />}
    </Modal>
  );
}

type Errors = Partial<Record<"rating" | "difficulty" | "workload" | "wouldRecommend" | "semester" | "text" | "tag", string>>;

function ReviewForm({ formId, course, onDone }: { formId: string; course: ReviewFormCourse; onDone: () => void }) {
  const [rating, setRating] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [workload, setWorkload] = useState<number | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [professor, setProfessor] = useState(course.professors[0] ?? "");
  const [semester, setSemester] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const formRef = useRef<HTMLFormElement>(null);

  const toggleTag = (t: string) => {
    setErrors((e) => ({ ...e, tag: undefined }));
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    const errs: Errors = {};
    if (!rating) errs.rating = "Rate the overall quality.";
    if (!difficulty) errs.difficulty = "Rate the difficulty.";
    if (!workload) errs.workload = "Rate the workload.";
    if (wouldRecommend === null) errs.wouldRecommend = "Choose yes or no.";
    if (!semester) errs.semester = "Pick the semester you took it.";
    if (trimmed.length < MIN_REVIEW_CHARS) errs.text = `Write at least ${MIN_REVIEW_CHARS} characters (${trimmed.length} so far).`;
    setErrors(errs);
    if (Object.keys(errs).length) {
      // Move focus to the first problem so keyboard and screen reader users find it.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }
    reviewsStore.add({
      courseId: course.id,
      professor: professor || "Not sure",
      semester,
      rating: rating!,
      difficulty: difficulty!,
      workload: workload!,
      wouldRecommend: wouldRecommend!,
      tags,
      text: trimmed.slice(0, MAX_REVIEW_CHARS),
    });
    onDone();
    showToast("Thanks! Your review is posted.");
  }

  return (
    <form id={formId} ref={formRef} onSubmit={submit} noValidate className="space-y-6">
      <Scale
        label="Quality"
        low="Awful"
        high="Awesome"
        value={rating}
        onChange={(v) => {
          setRating(v);
          setErrors((e) => ({ ...e, rating: undefined }));
        }}
        error={errors.rating}
      />
      <Scale
        label="Difficulty"
        low="Very easy"
        high="Very hard"
        value={difficulty}
        onChange={(v) => {
          setDifficulty(v);
          setErrors((e) => ({ ...e, difficulty: undefined }));
        }}
        error={errors.difficulty}
      />
      <Scale
        label="Workload"
        low="Very light"
        high="Very heavy"
        value={workload}
        onChange={(v) => {
          setWorkload(v);
          setErrors((e) => ({ ...e, workload: undefined }));
        }}
        error={errors.workload}
      />

      <fieldset>
        <legend className="mb-2 text-[15px] font-semibold">Would take again</legend>
        <div className="grid max-w-xs grid-cols-2 gap-2" role="radiogroup" aria-label="Would take again">
          {[
            [true, "Yes"],
            [false, "No"],
          ].map(([v, label], i) => {
            const on = wouldRecommend === v;
            return (
              <button
                key={label as string}
                type="button"
                role="radio"
                aria-checked={on}
                aria-invalid={i === 0 && errors.wouldRecommend ? true : undefined}
                onClick={() => {
                  setWouldRecommend(v as boolean);
                  setErrors((e) => ({ ...e, wouldRecommend: undefined }));
                }}
                className={`h-11 rounded-xl border text-[15px] font-medium transition-colors ${
                  on ? "border-black bg-black text-white" : "border-neutral-300 hover:border-black"
                }`}
              >
                {label as string}
              </button>
            );
          })}
        </div>
        <FieldError msg={errors.wouldRecommend} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">Professor</span>
          <select
            value={professor}
            onChange={(e) => setProfessor(e.target.value)}
            className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base hover:border-black"
          >
            {course.professors.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="Not sure">Not sure</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">Semester taken</span>
          <select
            value={semester}
            onChange={(e) => {
              setSemester(e.target.value);
              setErrors((er) => ({ ...er, semester: undefined }));
            }}
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
            if (errors.text && e.target.value.trim().length >= MIN_REVIEW_CHARS) setErrors((er) => ({ ...er, text: undefined }));
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
        <p className="mt-1.5 text-xs text-neutral-500">Be fair and specific. Reviews are stored in this browser for the demo.</p>
      </label>
    </form>
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
