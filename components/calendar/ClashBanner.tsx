import type { Clash } from "@/lib/schedule";

/** Lists timetable clashes. Monochrome: hatched frame + thick border instead of red. */
export function ClashBanner({ clashes, className = "" }: { clashes: Clash[]; className?: string }) {
  if (!clashes.length) return null;
  return (
    <div role="alert" className={`rounded-2xl border-2 border-black p-[4px] [background-image:var(--hatch)] ${className}`}>
      <div className="rounded-xl bg-white px-4 py-3">
        <p className="text-[15px] font-bold">
          {clashes.length === 1 ? "1 timetable clash" : `${clashes.length} timetable clashes`}
        </p>
        <ul className="mt-1 space-y-0.5 text-sm text-neutral-700">
          {clashes.map((c, i) => (
            <li key={i}>
              {c.a.name} ({c.a.section}) and {c.b.name} ({c.b.section}) overlap on <strong className="text-black">{c.day} {c.start}–{c.end}</strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
