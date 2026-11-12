"use client";

// Broddy chat state. History is persisted in localStorage; the reply being streamed lives in memory.
// Both the desktop panel and the phone sheet render from these stores, so they stay in sync.
import { createLocalStore } from "./localStore";
import { createMemoryStore } from "./memoryStore";
import { myCoursesStore } from "./myCoursesStore";
import { profileStore } from "./profileStore";
import { reviewsStore } from "./reviewsStore";
import type { CreditCategory } from "./credits";
import { ImageCheckError, prepareScreenshot } from "./imageUtils";
import type { ChatEvent, RefCourse, RefSection } from "./tokens";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  refs?: Record<string, RefCourse>;
  secs?: Record<string, RefSection>;
  via?: string;
  error?: boolean;
  /** Thumbnail (data URL) of an uploaded screenshot, shown in the student's bubble. */
  image?: string;
  /** Extracted credits table, edited and confirmed in the bubble. */
  credits?: { categories: CreditCategory[]; status: "draft" | "saved" | "discarded" };
}

export interface PendingReply {
  text: string;
  refs: Record<string, RefCourse>;
  secs: Record<string, RefSection>;
  via?: string;
}

export type ChatPage = "reviews" | "course" | "courses" | "calendar" | "other";

const history = createLocalStore<ChatMessage[]>("crai.chat.v1", []);
const pending = createMemoryStore<PendingReply | null>(null);
let controller: AbortController | null = null;

const uid = () => `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const MAX_STORED = 80;

export const chatStore = {
  useMessages: () => history.useValue(),
  usePending: () => pending.useValue(),

  /** Add a message without calling the chat API (local Broddy replies). */
  say(text: string, extra: Partial<ChatMessage> = {}) {
    history.set((h) => [...h, { id: uid(), role: "assistant" as const, text, at: Date.now(), ...extra }].slice(-MAX_STORED));
  },

  updateMessage(id: string, patch: Partial<ChatMessage>) {
    history.set((h) => h.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  },

  /** Credits screenshot -> /api/extract-credits -> editable table bubble. */
  async uploadCredits(file: File) {
    if (pending.get()) return;
    let prepared: Awaited<ReturnType<typeof prepareScreenshot>>;
    try {
      prepared = await prepareScreenshot(file);
    } catch (e) {
      chatStore.say(e instanceof ImageCheckError ? e.message : "I couldn't open that image. Try another screenshot.", { error: true });
      return;
    }
    history.set((h) =>
      [...h, { id: uid(), role: "user" as const, text: "Here's my credits screenshot.", image: prepared.thumb, at: Date.now() }].slice(-MAX_STORED),
    );
    pending.set({ text: "", refs: {}, secs: {} });
    try {
      const form = new FormData();
      form.append("image", prepared.upload, "credits.jpg");
      const res = await fetch("/api/extract-credits", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; categories?: CreditCategory[] };
      pending.set(null);
      if (json.ok && json.categories?.length) {
        chatStore.say("Here's what I read from your screenshot. Check the numbers, fix anything I got wrong, then confirm and I'll save it to your profile.", {
          credits: { categories: json.categories, status: "draft" },
        });
      } else {
        chatStore.say(json.message || "I couldn't read images right now. Please try the upload again in a minute.", { error: true });
      }
    } catch {
      pending.set(null);
      chatStore.say("The upload didn't go through. Check your connection and try again in a minute.", { error: true });
    }
  },

  newChat() {
    controller?.abort();
    controller = null;
    pending.set(null);
    history.set([]);
  },

  async send(text: string, ctx: { page: ChatPage; courseId?: string | null }) {
    const clean = text.trim();
    if (!clean || pending.get()) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", text: clean, at: Date.now() };
    history.set((h) => [...h, userMsg].slice(-MAX_STORED));
    pending.set({ text: "", refs: {}, secs: {} });

    const myCourses = myCoursesStore.getAll();
    const relevant = new Set([ctx.courseId, ...myCourses.map((m) => m.courseId)].filter(Boolean));
    const userReviews = reviewsStore.getUserReviews().filter((r) => relevant.has(r.courseId));
    const messages = history.get().slice(-12).map((m) => ({ role: m.role, text: m.text }));

    controller = new AbortController();
    const reply: PendingReply = { text: "", refs: {}, secs: {} };
    let failed = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages,
          profile: profileStore.get(),
          page: ctx.page,
          courseId: ctx.courseId ?? null,
          myCourses: myCourses.map((m) => ({ courseId: m.courseId, section: m.section })),
          userReviews,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as ChatEvent;
          if (ev.t === "text") reply.text += ev.v;
          else if (ev.t === "ref") reply.refs = { ...reply.refs, [ev.course.id]: ev.course };
          else if (ev.t === "sec") reply.secs = { ...reply.secs, [`${ev.section.courseId}:${ev.section.section}`]: ev.section };
          else if (ev.t === "meta") reply.via = ev.model;
          else if (ev.t === "error") {
            reply.text = ev.v;
            failed = true;
          }
          pending.set({ ...reply });
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      reply.text = "I'm a bit overloaded, try again in a few seconds.";
      failed = true;
    } finally {
      controller = null;
    }
    pending.set(null);
    if (!reply.text.trim()) {
      reply.text = "Hmm, I lost my train of thought. Could you ask that again?";
      failed = true;
    }
    history.set((h) =>
      [...h, { id: uid(), role: "assistant" as const, text: reply.text, at: Date.now(), refs: reply.refs, secs: reply.secs, via: reply.via, error: failed }].slice(
        -MAX_STORED,
      ),
    );
  },
};
