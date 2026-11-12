import { cleanReviews, str } from "@/lib/apiInput";
import { getCourse, getSeedReviews } from "@/lib/catalog";
import { generateJson, LlmUnavailableError } from "@/lib/llm";
import { publicReview, takenLine } from "@/lib/reviewDisplay";

export const maxDuration = 60;

export interface ReviewSummary {
  pros: string[];
  cons: string[];
  difficulty: string;
  workload: string;
  bestFor: string;
  watchOut: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    pros: { type: "array", items: { type: "string" }, description: "2-4 short pros" },
    cons: { type: "array", items: { type: "string" }, description: "2-4 short cons" },
    difficulty: { type: "string", description: "One sentence, cite the average" },
    workload: { type: "string", description: "One sentence, cite the average" },
    bestFor: { type: "string", description: "One sentence: what kind of student will like it" },
    watchOut: { type: "string", description: "One sentence: the main warning" },
  },
  required: ["pros", "cons", "difficulty", "workload", "bestFor", "watchOut"],
};

// Server memory cache per course + set of user reviews.
const cache = new Map<string, { summary: ReviewSummary; via: string }>();

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const course = getCourse(str(body.courseId, 200));
  if (!course) return Response.json({ error: "Unknown course" }, { status: 404 });

  const userReviews = cleanReviews(body.userReviews).filter((r) => r.courseId === course.id && r.moderation !== "hidden").map(publicReview);
  const reviews = [...userReviews, ...getSeedReviews(course.id)];
  if (reviews.length === 0) return Response.json({ error: "No reviews to summarize yet." }, { status: 422 });

  const key = `${course.id}|${userReviews.map((r) => r.id + r.text.length).join(",")}`;
  const hit = cache.get(key);
  if (hit) return Response.json({ ...hit, cached: true });

  const avg = (k: "rating" | "difficulty" | "workload") => (reviews.reduce((s, r) => s + r[k], 0) / reviews.length).toFixed(1);
  const system =
    "You summarize student course reviews for a course review site. Be concise, specific and fair. Use only the reviews given. Short phrases, no fluff. Cite averages where asked.";
  const prompt = `Course: ${course.name} (${course.program}, ${course.type}).
Averages: quality ${avg("rating")}/5, difficulty ${avg("difficulty")}/5, workload ${avg("workload")}/5, ${reviews.length} reviews, would take again ${Math.round((100 * reviews.filter((r) => r.wouldRecommend).length) / reviews.length)}%.
Reviews:
${reviews.map((r) => `- Q${r.rating} D${r.difficulty} W${r.workload} | ${takenLine(r)} | tags: ${r.tags.join(", ") || "-"} | ${r.text}`).join("\n")}`;

  try {
    const { data, provider, model } = await generateJson<ReviewSummary>({
      label: "summarize",
      system,
      messages: [{ role: "user", text: prompt }],
      schema: SCHEMA,
    });
    const value = { summary: data, via: `${provider}/${model}` };
    cache.set(key, value);
    return Response.json(value);
  } catch (e) {
    if (!(e instanceof LlmUnavailableError)) console.error("[summarize]", e);
    return Response.json({ error: "The AI is busy right now. Try again in a few seconds." }, { status: 503 });
  }
}
