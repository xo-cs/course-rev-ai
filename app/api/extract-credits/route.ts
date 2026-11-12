import { generateJsonFromImage, LlmUnavailableError } from "@/lib/llm";

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "image/gif"];

export interface ExtractResult {
  ok: boolean;
  message?: string;
  categories?: { name: string; required: number; earned: number }[];
}

const SCHEMA = {
  type: "object",
  properties: {
    isCreditsPage: { type: "boolean", description: "True if the image shows a graduation/credits status table" },
    readable: { type: "boolean", description: "False if the image is too blurry, cropped or small to read numbers reliably" },
    problem: { type: "string", description: "If not a credits page or not readable: a short, friendly explanation for the student" },
    categories: {
      type: "array",
      description: "One entry per credit category row (exclude the Total row)",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          required: { type: "number" },
          earned: { type: "number" },
          remaining: { type: "number" },
        },
        required: ["name", "required", "earned", "remaining"],
      },
    },
  },
  required: ["isCreditsPage", "readable", "problem", "categories"],
};

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) return Response.json({ ok: false, message: "No image received. Try choosing it again." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ ok: false, message: "That image is over 5MB. Try a smaller screenshot." }, { status: 413 });
  if (!TYPES.includes(file.type)) return Response.json({ ok: false, message: "Please upload a PNG or JPG screenshot." }, { status: 415 });

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const { data } = await generateJsonFromImage<{
      isCreditsPage: boolean;
      readable: boolean;
      problem: string;
      categories: { name: string; required: number; earned: number; remaining: number }[];
    }>({
      label: "extract-credits",
      system:
        "You read screenshots of a university student portal's graduation credit page. Extract the credit categories exactly as shown (category name, required, earned, remaining). Do not invent rows or numbers: if any digit is not clearly legible (blurry, tiny, cut off), set readable to false instead of guessing. Ignore personal details such as names and student IDs and never return them.",
      prompt: "Extract the graduation credit table from this screenshot.",
      image: { base64, mimeType: file.type },
      schema: SCHEMA,
    });

    // Sanity check: on a real credits table, remaining = required - earned on (almost) every row.
    const rows = (data.categories ?? []).filter((c) => c && Number.isFinite(Number(c.remaining)));
    const inconsistent = rows.filter((c) => Math.abs(Number(c.required) - Number(c.earned) - Number(c.remaining)) > 0.5 && Number(c.remaining) !== 0).length;
    if (rows.length && inconsistent > rows.length / 2)
      return Response.json({ ok: false, message: "Some numbers didn't add up, so I might be misreading the image. Try a sharper screenshot of just the credits table." });

    const categories = (data.categories ?? [])
      .filter((c) => c && typeof c.name === "string" && !/^total|합계|계$/i.test(c.name.trim()))
      .map((c) => ({
        name: c.name.trim().slice(0, 60),
        required: Math.max(0, Math.round(Number(c.required) || 0)),
        earned: Math.max(0, Math.round(Number(c.earned) || 0)),
      }))
      .slice(0, 20);

    if (!data.isCreditsPage)
      return Response.json({
        ok: false,
        message: data.problem || "This doesn't look like a credits page. Upload a screenshot of the graduation credit table from the student portal.",
      });
    if (!data.readable || categories.length === 0)
      return Response.json({
        ok: false,
        message: data.problem || "I couldn't read the numbers clearly. Try a sharper screenshot, zoomed in on the credits table.",
      });
    return Response.json({ ok: true, categories } satisfies ExtractResult);
  } catch (e) {
    if (!(e instanceof LlmUnavailableError)) console.error("[extract-credits]", e);
    return Response.json({ ok: false, message: "I couldn't read images right now. Please try the upload again in a minute." }, { status: 503 });
  }
}
