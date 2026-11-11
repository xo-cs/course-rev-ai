"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { profileStore } from "@/lib/profileStore";
import type { Profile } from "@/lib/types";

export function ProfileModal({ open, onClose, programs }: { open: boolean; onClose: () => void; programs: string[] }) {
  return (
    <Modal open={open} onClose={onClose} title="Your profile">
      {/* Re-mount the form each time it opens so it starts from the saved profile. */}
      {open && <ProfileForm programs={programs} onDone={onClose} />}
    </Modal>
  );
}

function ProfileForm({ programs, onDone }: { programs: string[]; onDone: () => void }) {
  const [draft, setDraft] = useState<Profile>(() => profileStore.get());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        profileStore.set(draft);
        onDone();
      }}
      className="space-y-5"
    >
      <p className="text-sm text-neutral-600">Broddy uses this to judge whether a course fits you. It stays in this browser.</p>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Major / program</span>
        <select
          value={draft.program ?? ""}
          onChange={(e) => setDraft({ ...draft, program: e.target.value || null })}
          className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm hover:border-black"
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
        <legend className="mb-1.5 block text-sm font-medium">Year</legend>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((y) => {
            const on = draft.year === y;
            return (
              <button
                key={y}
                type="button"
                aria-pressed={on}
                onClick={() => setDraft({ ...draft, year: on ? null : y })}
                className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                  on ? "border-black bg-black text-white" : "border-neutral-300 hover:border-black"
                }`}
              >
                Year {y}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="h-10 rounded-full px-4 text-sm font-medium hover:bg-neutral-100">
          Cancel
        </button>
        <button type="submit" className="h-10 rounded-full bg-black px-5 text-sm font-medium text-white hover:bg-neutral-800">
          Save
        </button>
      </div>
    </form>
  );
}
