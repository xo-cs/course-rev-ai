// Demo-grade admin gate: a passcode from ADMIN_PASSCODE, checked on the server,
// remembered in an httpOnly cookie that holds a hash (never the passcode itself).
// This is NOT real security; it only keeps casual visitors out during the demo.
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "crai_admin";

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSCODE?.trim());
}

export function adminToken() {
  return createHash("sha256").update(`courserevai-admin:${process.env.ADMIN_PASSCODE?.trim() ?? ""}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPasscode(input: string) {
  return adminConfigured() && safeEqual(input.trim(), process.env.ADMIN_PASSCODE!.trim());
}

export function isAdminToken(value: string | undefined) {
  return adminConfigured() && Boolean(value) && safeEqual(value!, adminToken());
}
