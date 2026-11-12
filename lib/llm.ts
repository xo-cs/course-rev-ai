// All LLM calls go through this file. Server only: reads API keys from env.
//
// Order: GEMINI_MODEL (retry once after 1s on 503/429) -> each GEMINI_FALLBACK_MODELS -> Groq.
// Gemini is called through the Interactions API only (generateContent is not available
// for this account). A model that just failed with 503/429/timeout is skipped for a short
// cooldown so one overloaded model doesn't slow down every request.
import "server-only";
import { GoogleGenAI } from "@google/genai";

export interface LlmMessage {
  role: "user" | "assistant";
  text: string;
}

export interface LlmCall {
  /** Short name for logs, e.g. "chat", "summarize". */
  label: string;
  system: string;
  messages: LlmMessage[];
}

export type StreamEvent = { type: "provider"; provider: "gemini" | "groq"; model: string } | { type: "text"; text: string };

export class LlmUnavailableError extends Error {
  constructor(message = "All LLM providers failed") {
    super(message);
  }
}

const PRIMARY_TIMEOUT_MS = 12_000;
const FALLBACK_TIMEOUT_MS = 25_000;
const COOLDOWN_MS = 180_000;
const HEDGE_MS = 4_500;
const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";

// ---------- config ----------
function geminiModels() {
  const primary = process.env.GEMINI_MODEL?.trim();
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks].filter(Boolean) as string[])];
}

let client: GoogleGenAI | null = null;
function gemini() {
  if (!process.env.GEMINI_API_KEY) return null;
  // v1beta is required for structured JSON output on the Interactions API.
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: "v1beta" });
  return client;
}

// ---------- small helpers ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cooldownUntil = new Map<string, number>();
/** Models that reject thinking_level "minimal" (learned at runtime). */
const thinkingLevel = new Map<string, "minimal" | "low">();

function statusOf(e: unknown): number | undefined {
  const err = e as { status?: number; statusCode?: number; message?: string };
  if (typeof err?.status === "number") return err.status;
  if (typeof err?.statusCode === "number") return err.statusCode;
  const m = String(err?.message ?? "").match(/\b(4\d\d|5\d\d)\b/);
  return m ? Number(m[1]) : undefined;
}
const isTimeout = (e: unknown) => /timed? ?out|aborted due to timeout/i.test(String((e as Error)?.message ?? e));
const isOverload = (e: unknown) => [429, 503].includes(statusOf(e) ?? 0) || /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(String((e as Error)?.message));
const isThinkingLevelError = (e: unknown) => statusOf(e) === 400 && /thinking level/i.test(String((e as Error)?.message));
const short = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 160);

/** Gemini input: one transcript string (robust across models; the last line is the student's message). */
function toInput(messages: LlmMessage[]) {
  if (messages.length === 1) return messages[0].text;
  const lines = messages.map((m) => `${m.role === "user" ? "Student" : "Broddy"}: ${m.text}`);
  return `Conversation so far (latest message last):\n\n${lines.join("\n\n")}\n\nReply as Broddy to the student's latest message.`;
}

type GeminiFn<T> = (ai: GoogleGenAI, model: string, timeoutMs: number, level: "minimal" | "low") => Promise<T>;

/**
 * Run fn against the Gemini models in order with the retry rules.
 * Hedging: the primary model gets a head start; if it hasn't succeeded after HEDGE_MS,
 * the fallback chain starts in parallel and the first success wins. The primary is still
 * preferred whenever it is fast. `dispose` closes a result that lost the race (open streams).
 */
async function withGemini<T>(label: string, fn: GeminiFn<T>, dispose?: (v: T) => void): Promise<{ value: T; model: string }> {
  const ai = gemini();
  if (!ai) throw new LlmUnavailableError("GEMINI_API_KEY missing");
  const [primary, ...rest] = geminiModels();
  if (!primary) throw new LlmUnavailableError("GEMINI_MODEL missing");
  if (!rest.length) return runChain(ai, label, [primary], 0, fn);

  return new Promise((resolve, reject) => {
    let settled = false;
    let failures = 0;
    let started = 1;
    let lastErr: unknown;
    const onOk = (r: { value: T; model: string }) => {
      if (settled) return dispose?.(r.value);
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const onErr = (e: unknown) => {
      lastErr = e;
      failures++;
      if (!fallbackStarted) startFallback();
      else if (failures >= started && !settled) {
        settled = true;
        reject(lastErr);
      }
    };
    let fallbackStarted = false;
    const startFallback = () => {
      if (fallbackStarted || settled) return;
      fallbackStarted = true;
      started = 2;
      runChain(ai, label, rest, 1, fn).then(onOk, onErr);
    };
    const timer = setTimeout(() => {
      if (!settled) console.info(`[llm] ${label}: ${primary} slow, starting fallback in parallel`);
      startFallback();
    }, HEDGE_MS);
    runChain(ai, label, [primary], 0, fn).then(onOk, onErr);
  });
}

async function runChain<T>(ai: GoogleGenAI, label: string, models: string[], offset: number, fn: GeminiFn<T>) {
  let lastErr: unknown;
  for (let j = 0; j < models.length; j++) {
    const i = j + offset;
    const model = models[j];
    if ((cooldownUntil.get(model) ?? 0) > Date.now()) {
      console.info(`[llm] ${label}: skipping ${model} (cooling down)`);
      continue;
    }
    const timeoutMs = i === 0 ? PRIMARY_TIMEOUT_MS : FALLBACK_TIMEOUT_MS;
    const maxAttempts = i === 0 ? 2 : 1; // primary: retry once after 1s on 503/429
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const level = thinkingLevel.get(model) ?? "minimal";
      try {
        return { value: await fn(ai, model, timeoutMs, level), model };
      } catch (e) {
        lastErr = e;
        if (isThinkingLevelError(e) && level === "minimal") {
          thinkingLevel.set(model, "low");
          attempt--; // not a real failure, retry right away with "low"
          continue;
        }
        console.warn(`[llm] ${label}: ${model} failed (${statusOf(e) ?? (isTimeout(e) ? "timeout" : "error")}): ${short(e)}`);
        if (isOverload(e) && attempt < maxAttempts) {
          await sleep(1000);
          continue;
        }
        if (isOverload(e) || isTimeout(e)) cooldownUntil.set(model, Date.now() + COOLDOWN_MS);
        break;
      }
    }
  }
  throw lastErr ?? new LlmUnavailableError("No Gemini model available");
}

// ---------- Groq (OpenAI compatible) ----------
function groqModels() {
  return [...new Set([process.env.GROQ_MODEL?.trim(), GROQ_DEFAULT_MODEL].filter(Boolean) as string[])];
}

async function groqFetch(body: Record<string, unknown>, stream: boolean) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new LlmUnavailableError("GROQ_API_KEY missing");
  let lastErr: unknown;
  for (const model of groqModels()) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ ...body, model, stream, ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}) }),
      signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS),
    });
    if (res.ok) return { res, model };
    const text = await res.text().catch(() => "");
    lastErr = new Error(`Groq ${res.status}: ${text.slice(0, 160)}`);
    console.warn(`[llm] groq ${model} failed: ${short(lastErr)}`);
    if (res.status !== 404 && !/model_not_found|decommissioned/.test(text)) break; // only try the next model if this one doesn't exist
  }
  throw lastErr;
}

const toOpenAi = (call: LlmCall) => [
  { role: "system", content: call.system },
  ...call.messages.map((m) => ({ role: m.role, content: m.text })),
];

// ---------- public API ----------

/** Streams a chat reply. First event is always { type: "provider" }. Throws LlmUnavailableError if everything fails. */
export async function* streamText(call: LlmCall): AsyncGenerator<StreamEvent> {
  // Gemini: open the stream and wait for the first real text before committing to a model,
  // so a model that fails early can still fall back.
  try {
    const { value, model } = await withGemini(call.label, async (ai, model, timeoutMs, level) => {
      const stream = await ai.interactions.create(
        {
          model,
          input: toInput(call.messages),
          system_instruction: call.system,
          stream: true,
          generation_config: { thinking_level: level },
        },
        { retries: { strategy: "none" }, timeout_ms: timeoutMs },
      );
      const it = stream[Symbol.asyncIterator]();
      // Pull until the first text delta (thought steps are skipped).
      const deadline = Date.now() + timeoutMs;
      while (true) {
        const next = await Promise.race([
          it.next(),
          sleep(Math.max(0, deadline - Date.now())).then(() => {
            throw new Error("Request timed out waiting for first token");
          }),
        ]);
        if (next.done) throw new Error("Stream ended without text");
        const ev = next.value as { event_type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
        if (ev.event_type === "error") throw new Error(ev.error?.message ?? "stream error");
        if (ev.event_type === "step.delta" && ev.delta?.type === "text" && ev.delta.text) return { it, first: ev.delta.text };
      }
    }, (lost) => void lost.it.return?.());
    console.info(`[llm] ${call.label}: answered by gemini/${model}`);
    yield { type: "provider", provider: "gemini", model };
    yield { type: "text", text: value.first };
    while (true) {
      const next = await value.it.next();
      if (next.done) break;
      const ev = next.value as { event_type?: string; delta?: { type?: string; text?: string } };
      if (ev.event_type === "step.delta" && ev.delta?.type === "text" && ev.delta.text) yield { type: "text", text: ev.delta.text };
    }
    return;
  } catch (e) {
    console.warn(`[llm] ${call.label}: all Gemini models failed, trying Groq. Last error: ${short(e)}`);
  }

  // Groq fallback (SSE)
  let groq: Awaited<ReturnType<typeof groqFetch>>;
  try {
    groq = await groqFetch({ messages: toOpenAi(call) }, true);
  } catch (e) {
    console.error(`[llm] ${call.label}: Groq failed too: ${short(e)}`);
    throw new LlmUnavailableError();
  }
  console.info(`[llm] ${call.label}: answered by groq/${groq.model}`);
  yield { type: "provider", provider: "groq", model: groq.model };
  const reader = groq.res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.replace(/^data:\s*/, "").trim();
      if (!data || data === "[DONE]") continue;
      try {
        const text = JSON.parse(data).choices?.[0]?.delta?.content;
        if (text) yield { type: "text", text };
      } catch {
        /* partial line */
      }
    }
  }
}

/** One-shot structured JSON answer. Throws LlmUnavailableError if everything fails. */
export async function generateJson<T>(call: LlmCall & { schema: Record<string, unknown> }): Promise<{ data: T; provider: string; model: string }> {
  try {
    const { value, model } = await withGemini(call.label, async (ai, model, timeoutMs, level) => {
      const res = await ai.interactions.create(
        {
          model,
          input: toInput(call.messages),
          system_instruction: call.system,
          generation_config: { thinking_level: level },
          response_mime_type: "application/json",
          response_format: { type: "text", mime_type: "application/json", schema: call.schema },
        },
        { retries: { strategy: "none" }, timeout_ms: timeoutMs },
      );
      return JSON.parse(outputText(res)) as T;
    });
    console.info(`[llm] ${call.label}: answered by gemini/${model}`);
    return { data: value, provider: "gemini", model };
  } catch (e) {
    console.warn(`[llm] ${call.label}: all Gemini models failed, trying Groq. Last error: ${short(e)}`);
  }
  try {
    const { res, model } = await groqFetch(
      {
        messages: [
          { role: "system", content: `${call.system}\n\nRespond with JSON only, matching this JSON schema:\n${JSON.stringify(call.schema)}` },
          ...call.messages.map((m) => ({ role: m.role, content: m.text })),
        ],
        response_format: { type: "json_object" },
      },
      false,
    );
    const json = await res.json();
    const data = JSON.parse(json.choices?.[0]?.message?.content ?? "") as T;
    console.info(`[llm] ${call.label}: answered by groq/${model}`);
    return { data, provider: "groq", model };
  } catch (e) {
    console.error(`[llm] ${call.label}: Groq failed too: ${short(e)}`);
    throw new LlmUnavailableError();
  }
}

/** Text of a finished interaction: `output_text`, or the model_output steps (thought steps ignored). */
function outputText(res: unknown): string {
  const r = res as {
    output_text?: string;
    outputText?: string;
    steps?: { type: string; content?: { type?: string; text?: string }[] }[];
    outputs?: { type: string; content?: { type?: string; text?: string }[] }[];
  };
  if (r.output_text) return r.output_text;
  if (r.outputText) return r.outputText;
  const steps = r.steps ?? r.outputs ?? [];
  return steps
    .filter((s) => s.type === "model_output")
    .flatMap((s) => s.content ?? [])
    .map((c) => c.text ?? "")
    .join("");
}
