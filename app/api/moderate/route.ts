import { str } from "@/lib/apiInput";
import { generateJson } from "@/lib/llm";

export const maxDuration = 30;

const POLICY = `You moderate student course reviews on a university course review site.
Policy. A review is NOT allowed if it contains any of:
- insults or name-calling aimed at a person (professor, student, staff)
- personal attacks about someone's looks, private life, ethnicity, religion, gender, nationality, age
- hate speech or harassment
- spam, ads, links or text unrelated to the course
- private information about people (phone numbers, emails, home address, student IDs, rumours about private life)
Harsh but fair criticism of the course, teaching, grading or workload IS allowed. Swearing that is not aimed at a person is allowed.
If not allowed: give a short, kind reason addressed to the student, and a suggested rewrite that keeps their honest criticism but removes the problem. Keep the rewrite in the same language and similar length.
If allowed: reason and suggestion are empty strings.`;

const SCHEMA = {
  type: "object",
  properties: {
    allowed: { type: "boolean" },
    reason: { type: "string" },
    suggestion: { type: "string" },
  },
  required: ["allowed", "reason", "suggestion"],
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = str(body.text, 1500).trim();
  const tags = Array.isArray(body.tags) ? body.tags.slice(0, 8).map((t) => str(t, 30)) : [];
  if (!text) return Response.json({ error: "Missing text" }, { status: 400 });
  try {
    const { data } = await generateJson<{ allowed: boolean; reason: string; suggestion: string }>({
      label: "moderate",
      system: POLICY,
      messages: [{ role: "user", text: `Review text:\n"""${text}"""\nTags: ${tags.join(", ") || "-"}` }],
      schema: SCHEMA,
    });
    return Response.json({ allowed: Boolean(data.allowed), reason: data.reason ?? "", suggestion: data.suggestion ?? "" });
  } catch {
    // LLM unavailable: allow, but mark it so the admin can check later.
    return Response.json({ allowed: true, pending: true, reason: "", suggestion: "" });
  }
}
