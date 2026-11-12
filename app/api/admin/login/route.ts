import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminToken, checkPasscode } from "@/lib/adminAuth";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const passcode = String(form?.get("passcode") ?? "");
  const url = new URL("/admin", req.url);
  if (!checkPasscode(passcode)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing a little
    url.searchParams.set("error", "1");
    return Response.redirect(url, 303);
  }
  (await cookies()).set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return Response.redirect(url, 303);
}
