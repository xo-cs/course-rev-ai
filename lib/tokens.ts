// Course / action tokens in Broddy's replies: [[course-id]] and [[add:course-id:section]].
// The server validates every token against the catalog while streaming (unknown ones are dropped),
// which is the "no hallucinated courses" guarantee behind the Verified mark.
import type { Slot } from "./types";

export interface RefCourse {
  id: string;
  name: string;
  credits: number | null;
  program: string;
  quality: number | null;
  reviews: number;
}

export interface RefSection {
  courseId: string;
  section: string;
  professor: string;
  room: string;
  scheduleText: string;
  slots: Slot[];
}

/** NDJSON events from /api/chat. */
export type ChatEvent =
  | { t: "meta"; provider: string; model: string }
  | { t: "text"; v: string }
  | { t: "ref"; course: RefCourse }
  | { t: "sec"; section: RefSection }
  | { t: "done" }
  | { t: "error"; v: string };

export const TOKEN_RE = /\[\[(add:)?([^\]:\s]+)(?::([^\]\s]+))?\]\]/g;

/**
 * Incremental token filter. Feed text chunks; it returns text that is safe to emit,
 * holding back an unfinished "[[...". Each complete token goes through `check`,
 * which returns the token to keep (possibly normalized) or null to drop it.
 */
export function createTokenFilter(check: (token: { add: boolean; id: string; section?: string; raw: string }) => string | null) {
  let buf = "";
  const MAX_TOKEN = 160;

  function drain(final: boolean) {
    let out = "";
    while (buf.length) {
      const open = buf.indexOf("[[");
      if (open === -1) {
        // Keep a trailing "[" in case the next chunk starts with "[".
        if (!final && buf.endsWith("[")) {
          out += buf.slice(0, -1);
          buf = "[";
        } else {
          out += buf;
          buf = "";
        }
        break;
      }
      out += buf.slice(0, open);
      buf = buf.slice(open);
      const close = buf.indexOf("]]");
      if (close === -1) {
        if (!final && buf.length < MAX_TOKEN) break; // wait for more
        out += buf; // not a token after all
        buf = "";
        break;
      }
      const raw = buf.slice(0, close + 2);
      buf = buf.slice(close + 2);
      const m = /^\[\[(add:)?([^\]:\s]+)(?::([^\]\s]+))?\]\]$/.exec(raw.replace(/`/g, ""));
      const kept = m ? check({ add: Boolean(m[1]), id: m[2], section: m[3], raw }) : null;
      if (kept) out += kept;
    }
    return out;
  }

  return {
    push: (chunk: string) => {
      buf += chunk;
      return drain(false);
    },
    flush: () => drain(true),
  };
}
