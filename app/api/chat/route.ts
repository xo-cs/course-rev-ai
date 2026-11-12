import { cleanProfile, cleanReviews, str } from "@/lib/apiInput";
import { buildSystemPrompt, type ChatContextInput } from "@/lib/broddyPrompt";
import { getCourse, seedReviews } from "@/lib/catalog";
import { LlmUnavailableError, streamText, type LlmMessage } from "@/lib/llm";
import { totalsByCourse } from "@/lib/stats";
import { createTokenFilter, type ChatEvent } from "@/lib/tokens";

export const maxDuration = 60;

const OVERLOADED = "I'm a bit overloaded, try again in a few seconds.";
const PAGES = ["reviews", "course", "courses", "calendar", "other"] as const;
const seedTotals = totalsByCourse(seedReviews);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages: LlmMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .slice(-12)
    .map((m: { role?: string; text?: unknown }) => ({ role: m?.role === "assistant" ? "assistant" : "user", text: str(m?.text, 4000) }) as LlmMessage)
    .filter((m: LlmMessage) => m.text.trim());
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "Last message must be from the student" }, { status: 400 });
  }

  const courseId = str(body.courseId, 200) || null;
  const input: ChatContextInput = {
    profile: cleanProfile(body.profile),
    page: PAGES.includes(body.page as (typeof PAGES)[number]) ? (body.page as ChatContextInput["page"]) : "other",
    courseId: courseId && getCourse(courseId) ? courseId : null,
    myCourses: (Array.isArray(body.myCourses) ? body.myCourses : [])
      .slice(0, 20)
      .map((m: { courseId?: unknown; section?: unknown }) => ({ courseId: str(m?.courseId, 200), section: str(m?.section, 10) })),
    userReviews: cleanReviews(body.userReviews),
    latestMessage: messages[messages.length - 1].text,
  };
  const system = buildSystemPrompt(input);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const sentCourses = new Set<string>();
      const sentSections = new Set<string>();

      // Validate every token against the catalog. Unknown ones are dropped and logged.
      const filter = createTokenFilter(({ add, id, section, raw }) => {
        const course = getCourse(id);
        if (!course) {
          console.warn(`[broddy] dropped unknown course token ${raw}`);
          return null;
        }
        if (!sentCourses.has(id)) {
          sentCourses.add(id);
          const t = seedTotals[id];
          const mine = input.userReviews.filter((r) => r.courseId === id);
          const n = (t?.n ?? 0) + mine.length;
          const q = (t?.q ?? 0) + mine.reduce((s, r) => s + r.rating, 0);
          send({ t: "ref", course: { id, name: course.name, credits: course.credits, program: course.program, quality: n ? q / n : null, reviews: n } });
        }
        if (!add) return `[[${id}]]`;
        const s = course.sections.find((x) => x.section === section);
        if (!s) {
          console.warn(`[broddy] dropped add token with unknown section ${raw}`);
          return `[[${id}]]`; // keep the course chip, drop the bad action
        }
        const key = `${id}:${s.section}`;
        if (!sentSections.has(key)) {
          sentSections.add(key);
          send({ t: "sec", section: { courseId: id, section: s.section, professor: s.professor, room: s.room, scheduleText: s.schedule_text, slots: s.slots } });
        }
        return `[[add:${id}:${s.section}]]`;
      });

      try {
        for await (const ev of streamText({ label: "chat", system, messages })) {
          if (ev.type === "provider") send({ t: "meta", provider: ev.provider, model: ev.model });
          else {
            const out = filter.push(ev.text);
            if (out) send({ t: "text", v: out });
          }
        }
        const rest = filter.flush();
        if (rest) send({ t: "text", v: rest });
        send({ t: "done" });
      } catch (e) {
        if (!(e instanceof LlmUnavailableError)) console.error("[broddy] chat failed", e);
        send({ t: "error", v: OVERLOADED });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
