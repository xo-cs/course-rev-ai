"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useShell } from "@/components/shell/ShellContext";
import { BroddyAvatar, IconArrowUp, IconClose, IconPlus } from "@/components/ui/Icons";
import { chatStore, type ChatMessage, type ChatPage, type PendingReply } from "@/lib/chatStore";
import { broddyFocusStore, dismissedContextStore, pageCourseStore, uploadRequestStore } from "@/lib/pageContext";
import { CreditsEditor } from "./CreditsEditor";
import { PlanCards, PlanPicker } from "./PlanWidgets";
import { profileStore } from "@/lib/profileStore";
import { MessageContent } from "./MessageContent";

const SHOW_VIA = process.env.NODE_ENV === "development";
const GAP_MS = 10 * 60 * 1000;

function pageOf(pathname: string): ChatPage {
  if (pathname.startsWith("/reviews/")) return "course";
  if (pathname.startsWith("/reviews")) return "reviews";
  if (pathname.startsWith("/courses")) return "courses";
  if (pathname.startsWith("/calendar")) return "calendar";
  return "other";
}

const SUGGESTIONS: Record<ChatPage, string[]> = {
  course: ["Is this course good for me?", "Summarize the reviews", "Compare with a similar course"],
  reviews: ["Plan my semester", "Is this course good for me?", "Summarize the reviews"],
  courses: ["Plan my semester", "Am I taking too many credits?", "What else should I take?"],
  calendar: ["Plan my semester", "Do I have clashes?", "Find a course for my free Friday"],
  other: ["What does a Focus course mean?"],
};

function stamp(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

export function BroddyChat() {
  const pathname = usePathname();
  const page = pageOf(pathname);
  const messages = chatStore.useMessages();
  const pending = chatStore.usePending();
  const profile = profileStore.useValue();
  const pageCourse = pageCourseStore.useValue();
  const dismissed = dismissedContextStore.useValue();
  const focusTick = broddyFocusStore.useValue();
  const { openProfile } = useShell();
  const [draft, setDraft] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTick = uploadRequestStore.useValue();
  const [seenUploadTick, setSeenUploadTick] = useState(uploadTick);
  if (uploadTick !== seenUploadTick) {
    setSeenUploadTick(uploadTick);
    setUploadOpen(true);
  }

  async function useDemoScreenshot() {
    setUploadOpen(false);
    const blob = await fetch("/demo/credits-screenshot.png").then((r) => r.blob());
    void chatStore.uploadCredits(new File([blob], "credits-screenshot.png", { type: blob.type || "image/png" }));
  }
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // What Broddy is looking at (removable chip).
  const context =
    dismissed === pathname
      ? null
      : pageCourse
        ? { label: pageCourse.label, courseId: pageCourse.courseId }
        : page === "courses"
          ? { label: "My Courses", courseId: null }
          : page === "calendar"
            ? { label: "My calendar", courseId: null }
            : null;

  // Focus the input when asked (Ask Broddy buttons).
  useEffect(() => {
    if (focusTick) inputRef.current?.focus({ preventScroll: true });
  }, [focusTick]);

  // Keep the log pinned to the bottom while new text streams in, unless the user scrolled up.
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  // Auto-grow the textarea (up to ~5 lines).
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [draft]);

  function send(text: string) {
    if (!text.trim() || pending) return;
    stickToBottom.current = true;
    setDraft("");
    void chatStore.send(text, { page, courseId: context?.courseId ?? null });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter = new line. Ignore Enter while composing Korean/Japanese/Chinese.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  }

  const needsProfile = !profile.program || !profile.year;
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");

  return (
    <>
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation with Broddy"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-4"
      >
        {/* Greeting (not stored) */}
        <Group role="assistant">
          <Bubble role="assistant" last>
            {needsProfile ? (
              <p>
                Hey{profile.name ? ` ${profile.name}` : ""}! I&apos;m Broddy, your course buddy. I read the course catalog and student reviews so
                you don&apos;t have to. What&apos;s your major and year?
              </p>
            ) : (
              <p>
                Hi {profile.name || "there"}! Ask me about any course, what students think of it, or whether it fits your timetable.
              </p>
            )}
          </Bubble>
        </Group>
        {needsProfile && messages.length === 0 && (
          <div className="mb-3 ml-1 flex flex-wrap gap-1.5">
            {[1, 2, 3, 4].map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={profile.year === y}
                onClick={() => profileStore.set({ ...profileStore.get(), year: y })}
                className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                  profile.year === y ? "border-black bg-black text-white" : "border-black hover:bg-neutral-100"
                }`}
              >
                Year {y}
              </button>
            ))}
            <button type="button" onClick={openProfile} className="h-9 rounded-full border border-black px-3.5 text-sm font-medium hover:bg-neutral-100">
              {profile.program ? profile.program : "Choose my major"}
            </button>
          </div>
        )}

        {groupMessages(messages).map((g) => (
          <div key={g.items[0].id}>
            {g.stamp && <p className="my-3 text-center text-[11px] font-medium text-neutral-500">{stamp(g.items[0].at)}</p>}
            <Group role={g.role}>
              {g.items.map((m, i) => (
                <div key={m.id}>
                  <Bubble role={m.role} last={i === g.items.length - 1}>
                    {m.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- local data URL thumbnail
                      <img src={m.image} alt="Uploaded credits screenshot" className="-mx-1.5 -mt-0.5 mb-1.5 max-h-48 w-auto max-w-[calc(100%+0.75rem)] rounded-xl bg-white object-contain" />
                    )}
                    {m.role === "assistant" ? <MessageContent text={m.text} refs={m.refs ?? {}} secs={m.secs ?? {}} /> : <p className="whitespace-pre-wrap">{m.text}</p>}
                    {m.credits && <CreditsEditor message={m} />}
                    {m.planPicker && <PlanPicker message={m} />}
                    {m.plans && <PlanCards plans={m.plans} />}
                  </Bubble>
                  {SHOW_VIA && m.role === "assistant" && m.via && <p className="ml-2 mt-0.5 text-[10px] text-neutral-400">via {m.via}</p>}
                  {m.role === "user" && messages.indexOf(m) === lastUserIdx && (
                    <p className="mr-2 mt-0.5 text-right text-[11px] text-neutral-500">Delivered</p>
                  )}
                </div>
              ))}
            </Group>
          </div>
        ))}

        {pending && <PendingBubble pending={pending} />}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-neutral-200 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pb-3">
        {uploadOpen && (
          <div role="dialog" aria-label="Upload your credits screenshot" className="mb-2 animate-fade-up rounded-2xl border border-black bg-white p-3 text-[13px] shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold">Upload your credits screenshot</p>
              <button type="button" onClick={() => setUploadOpen(false)} className="-mr-1 -mt-1 flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100" aria-label="Close">
                <IconClose width={16} height={16} />
              </button>
            </div>
            <p className="mt-1 text-neutral-600">
              The graduation credit page from the student portal. I&apos;ll read required, earned and remaining credits, and you can fix them before
              saving.
            </p>
            <p className="mt-2 rounded-lg bg-neutral-100 px-2.5 py-1.5 font-medium">Tip: Blur or crop your student ID before uploading.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="h-10 rounded-full bg-black px-4 font-semibold text-white hover:bg-neutral-800">
                Choose image
              </button>
              <button type="button" onClick={useDemoScreenshot} className="h-10 rounded-full border border-neutral-300 px-3.5 font-medium hover:border-black">
                Try the demo screenshot
              </button>
            </div>
            <p className="mt-2 text-[11px] text-neutral-500">PNG or JPG, up to 5MB.</p>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setUploadOpen(false);
            stickToBottom.current = true;
            void chatStore.uploadCredits(f);
          }}
        />
        {!pending && (
          <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
            {SUGGESTIONS[page].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="h-9 shrink-0 rounded-full border border-neutral-300 px-3.5 text-[13px] font-medium transition-colors hover:border-black"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {context && (
          <div className="mb-2 flex">
            <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-neutral-100 pl-3 pr-1 text-[13px]">
              <span className="text-neutral-500">Looking at</span>
              <span className="truncate font-semibold">{context.label}</span>
              <button
                type="button"
                onClick={() => dismissedContextStore.set(pathname)}
                className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200 hover:text-black"
                aria-label={`Remove ${context.label} from Broddy's context`}
              >
                <IconClose width={14} height={14} />
              </button>
            </span>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-end gap-2"
        >
          <button
            type="button"
            onClick={() => setUploadOpen((o) => !o)}
            disabled={Boolean(pending)}
            aria-expanded={uploadOpen}
            title="Upload your credits screenshot"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black transition-colors hover:bg-neutral-200 disabled:text-neutral-400"
            aria-label="Attach a credits screenshot"
          >
            <IconPlus />
          </button>
          <div className="flex min-h-11 flex-1 items-end rounded-[22px] border border-neutral-300 py-1 pl-4 pr-1.5 focus-within:border-black">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Message Broddy"
              aria-label="Message Broddy"
              enterKeyHint="send"
              className="max-h-[132px] min-w-0 flex-1 resize-none bg-transparent py-1.5 text-base leading-6 outline-none placeholder:text-neutral-400 focus-visible:outline-none lg:text-[15px]"
            />
            <button
              type="submit"
              disabled={!draft.trim() || Boolean(pending)}
              className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-black text-white transition-opacity disabled:bg-neutral-300"
              aria-label="Send"
            >
              <IconArrowUp width={16} height={16} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function groupMessages(messages: ChatMessage[]) {
  const groups: { role: ChatMessage["role"]; items: ChatMessage[]; stamp: boolean }[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const gap = !prev || m.at - prev.at > GAP_MS;
    const g = groups[groups.length - 1];
    if (g && g.role === m.role && !gap) g.items.push(m);
    else groups.push({ role: m.role, items: [m], stamp: gap });
  });
  return groups;
}

function Group({ role, children }: { role: ChatMessage["role"]; children: React.ReactNode }) {
  return (
    <div className={`mb-3 flex items-end gap-2 ${role === "user" ? "justify-end" : ""}`}>
      {role === "assistant" && <BroddyAvatar size={26} className="mb-0.5" />}
      <div className={`flex min-w-0 max-w-[min(85%,42rem)] flex-col gap-0.5 ${role === "user" ? "items-end" : "items-start"}`}>{children}</div>
    </div>
  );
}

function Bubble({ role, last, children }: { role: ChatMessage["role"]; last: boolean; children: React.ReactNode }) {
  const user = role === "user";
  return (
    <div
      className={`relative break-words rounded-[18px] px-3.5 py-2 text-[15px] leading-[1.4] ${
        user ? "animate-fade-up bg-black text-white" : "bg-neutral-100 text-black"
      } ${last ? (user ? "tail-user" : "tail-bot") : ""}`}
    >
      {children}
    </div>
  );
}

function PendingBubble({ pending }: { pending: PendingReply }) {
  return (
    <div className="mb-3 flex items-end gap-2">
      <BroddyAvatar size={26} className="mb-0.5" />
      <div className="min-w-0 max-w-[min(85%,42rem)]">
        {pending.text ? (
          <div className="tail-bot relative rounded-[18px] bg-neutral-100 px-3.5 py-2 text-[15px] leading-[1.4]">
            <MessageContent text={pending.text} refs={pending.refs} secs={pending.secs} />
          </div>
        ) : (
          <div className="tail-bot relative flex h-9 items-center gap-1 rounded-[18px] bg-neutral-100 px-4" role="status" aria-label="Broddy is typing">
            {[0, 1, 2].map((i) => (
              <span key={i} className="typing-dot size-2 rounded-full bg-neutral-400" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
