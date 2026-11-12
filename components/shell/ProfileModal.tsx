"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { profileStore } from "@/lib/profileStore";
import type { Profile } from "@/lib/types";

export function ProfileModal({ open, onClose, programs }: { open: boolean; onClose: () => void; programs: string[] }) {
  return (
    <Modal open={open} onClose={onClose} title="Demo sign in">
      {/* Re-mount the form each time it opens so it starts from the saved profile. */}
      {open && <ProfileForm programs={programs} onDone={onClose} />}
    </Modal>
  );
}

export function ProfileFields({
  draft,
  setDraft,
  programs,
  nameError,
}: {
  draft: Profile;
  setDraft: (p: Profile) => void;
  programs: string[];
  nameError?: string;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-semibold">Your name</span>
        <input
          value={draft.name ?? ""}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          maxLength={40}
          autoComplete="name"
          placeholder="e.g. Aziz Karimov"
          aria-invalid={nameError ? true : undefined}
          className={`h-12 w-full rounded-xl border px-3 text-base hover:border-black ${nameError ? "border-black ring-2 ring-black" : "border-neutral-300"}`}
        />
        {nameError && <span className="mt-1.5 block text-sm font-medium" role="alert">{nameError}</span>}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[15px] font-semibold">Major / program</span>
        <select
          value={draft.program ?? ""}
          onChange={(e) => setDraft({ ...draft, program: e.target.value || null })}
          className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-base hover:border-black"
        >
          <option value="">Not set</option>
          {programs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="mb-1.5 block text-[15px] font-semibold">Year</legend>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((y) => {
            const on = draft.year === y;
            return (
              <button
                key={y}
                type="button"
                aria-pressed={on}
                onClick={() => setDraft({ ...draft, year: on ? null : y })}
                className={`h-11 rounded-xl border text-[15px] font-medium transition-colors ${
                  on ? "border-black bg-black text-white" : "border-neutral-300 hover:border-black"
                }`}
              >
                Year {y}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

function ProfileForm({ programs, onDone }: { programs: string[]; onDone: () => void }) {
  const [draft, setDraft] = useState<Profile>(() => profileStore.get());
  const signedIn = Boolean(profileStore.get().name);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        profileStore.set({ ...draft, name: draft.name?.trim() || null });
        onDone();
      }}
      className="space-y-5"
    >
      <p className="text-sm text-neutral-600">
        No password. Your name, major and year stay in this browser. Broddy uses them to judge whether a course fits you, and you need
        a name to post reviews.
      </p>
      <ProfileFields draft={draft} setDraft={setDraft} programs={programs} />
      <div className="flex items-center justify-between gap-2 pt-1">
        {signedIn ? (
          <button
            type="button"
            onClick={() => {
              profileStore.signOut();
              onDone();
            }}
            className="h-11 rounded-full px-3 text-sm text-neutral-600 underline underline-offset-4 hover:text-black"
          >
            Sign out
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onDone} className="h-11 rounded-full px-4 text-[15px] font-medium hover:bg-neutral-100">
            Cancel
          </button>
          <button type="submit" className="h-11 rounded-full bg-black px-5 text-[15px] font-medium text-white hover:bg-neutral-800">
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
