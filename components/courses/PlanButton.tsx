"use client";

import { useShell } from "@/components/shell/ShellContext";
import { chatStore } from "@/lib/chatStore";

/** Entry point: opens Broddy and starts "Plan my semester". */
export function PlanButton({ className = "" }: { className?: string }) {
  const { openBroddy } = useShell();
  return (
    <button
      type="button"
      onClick={() => {
        openBroddy();
        chatStore.startPlanning();
      }}
      className={`inline-flex h-11 items-center rounded-full bg-black px-5 text-sm font-semibold text-white hover:bg-neutral-800 ${className}`}
    >
      Plan my semester
    </button>
  );
}
