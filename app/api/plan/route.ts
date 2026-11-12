import { cleanProfile, str } from "@/lib/apiInput";
import { buildPlans, type PlanPrefs } from "@/lib/planner";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const profile = cleanProfile(body.profile);
  const p = (body.prefs ?? {}) as Record<string, unknown>;
  const prefs: PlanPrefs = {
    credits: [12, 15, 18, 21].includes(Number(p.credits)) ? Number(p.credits) : 15,
    dayOff: p.dayOff === "Mon" || p.dayOff === "Fri" ? p.dayOff : "none",
    style: p.style === "light" || p.style === "challenging" ? p.style : "balanced",
  };
  const exclude = (Array.isArray(body.exclude) ? body.exclude : []).slice(0, 60).map((x) => str(x, 200));
  const t = performance.now();
  const result = buildPlans({ program: profile.program, year: profile.year, prefs, exclude, credits: profile.credits?.categories });
  return Response.json({ ...result, ms: Math.round(performance.now() - t) });
}
