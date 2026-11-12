import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminToken } from "@/lib/adminAuth";
import { generateJson, LlmUnavailableError } from "@/lib/llm";

export const maxDuration = 60;

export interface AdminInsights {
  findings: string[];
  weakCourses: { course: string; complaints: string[] }[];
  actions: string[];
}

const SCHEMA = {
  type: "object",
  properties: {
    findings: { type: "array", items: { type: "string" }, description: "Exactly 3 key findings, each citing numbers" },
    weakCourses: {
      type: "array",
      items: {
        type: "object",
        properties: { course: { type: "string" }, complaints: { type: "array", items: { type: "string" } } },
        required: ["course", "complaints"],
      },
    },
    actions: { type: "array", items: { type: "string" }, description: "Exactly 3 suggested actions for the university" },
  },
  required: ["findings", "weakCourses", "actions"],
};

const cache = new Map<string, AdminInsights>();

export async function POST(req: Request) {
  if (!isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value)) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { key?: string; stats?: unknown; weak?: unknown };
  const key = String(body.key ?? "").slice(0, 500);
  const hit = cache.get(key);
  if (hit) return Response.json({ insights: hit, cached: true });

  const stats = JSON.stringify(body.stats ?? {}).slice(0, 12_000);
  const weak = JSON.stringify(body.weak ?? []).slice(0, 30_000);
  try {
    const { data } = await generateJson<AdminInsights>({
      label: "admin-insights",
      system:
        "You are an analyst writing for a university's academic affairs team. Use only the statistics and reviews given. Be concrete and cite numbers (averages, counts, percentages). Never name or guess individual student reviewers. Many reviews are sample data for a demo; still analyse them as given.",
      messages: [
        {
          role: "user",
          text: `Aggregated statistics for the current filter:\n${stats}\n\nThe 5 weakest courses with their reviews:\n${weak}\n\nReturn: 3 key findings; for each weak course the main complaints (2-4 short phrases); 3 suggested actions for the university.`,
        },
      ],
      schema: SCHEMA,
    });
    cache.set(key, data);
    return Response.json({ insights: data });
  } catch (e) {
    if (!(e instanceof LlmUnavailableError)) console.error("[admin-insights]", e);
    return Response.json({ error: "The AI is busy right now. Try again in a few seconds." }, { status: 503 });
  }
}
