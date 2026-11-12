import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/adminAuth";

export async function POST(req: Request) {
  (await cookies()).delete(ADMIN_COOKIE);
  return Response.redirect(new URL("/admin", req.url), 303);
}
