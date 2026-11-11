import { fmtAvg } from "@/lib/stats";

/** The big square "Quality" box from the sketch. Black when rated, dashed when N/A. */
export function QualityBox({ value, count, size = "lg" }: { value: number | null; count?: number; size?: "lg" | "sm" }) {
  const na = value == null;
  const dims = size === "lg" ? "size-[72px] text-[28px]" : "size-12 text-lg";
  return (
    <div className="flex flex-col items-center">
      <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">Quality</span>
      <div
        className={`flex items-center justify-center rounded-xl font-bold tabular-nums tracking-tight ${dims} ${
          na ? "border border-dashed border-neutral-400 text-[15px] text-neutral-400" : "bg-black text-white"
        }`}
        aria-label={na ? "No quality rating yet" : `Quality ${fmtAvg(value)} out of 5`}
      >
        {fmtAvg(value)}
      </div>
      {count !== undefined && (
        <span className="mt-1 text-xs text-neutral-500 tabular-nums">
          {count} review{count === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{label}</span>
      <span className="text-[17px] font-semibold tabular-nums">{fmtAvg(value)}</span>
    </div>
  );
}
