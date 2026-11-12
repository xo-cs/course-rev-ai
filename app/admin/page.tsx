import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { ADMIN_COOKIE, adminConfigured, isAdminToken } from "@/lib/adminAuth";
import { courses, getSeedReviewsForAdmin, programs } from "@/lib/catalog";
import { typeGroup } from "@/lib/courseUtils";

export const metadata: Metadata = { title: "Admin dashboard", robots: { index: false } };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 pl-[max(1rem,env(safe-area-inset-left))] sm:px-8">
          <div className="flex items-baseline gap-3">
            <Link href="/reviews" className="text-[19px] font-bold tracking-tight">
              CourseRevAI
            </Link>
            <span className="rounded-md bg-black px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">Admin</span>
          </div>
          <Link href="/reviews" className="flex h-11 items-center text-sm text-neutral-600 hover:text-black">
            Back to the app
          </Link>
        </div>
      </header>
      <Suspense fallback={<p className="p-8 text-neutral-500">Loading…</p>}>
        <Gate searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Gate({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const authed = isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!authed) {
    const error = (await searchParams).error;
    return <Login error={Boolean(error)} configured={adminConfigured()} />;
  }
  const courseMeta = courses.map((c) => ({
    id: c.id,
    name: c.name,
    program: c.program,
    years: c.target_years,
    typeGroup: typeGroup(c.type),
    professors: c.professors,
  }));
  return <AdminDashboard courses={courseMeta} seedReviews={getSeedReviewsForAdmin()} programs={programs} />;
}

function Login({ error, configured }: { error: boolean; configured: boolean }) {
  return (
    <main className="mx-auto flex max-w-sm flex-col px-4 pt-20">
      <h1 className="text-2xl font-bold tracking-tight">University admin</h1>
      <p className="mt-2 text-[15px] text-neutral-600">Enter the admin passcode to see how courses are doing.</p>
      {!configured ? (
        <p className="mt-6 rounded-xl border-2 border-black p-4 text-sm">
          Admin is not set up: add <code className="font-mono">ADMIN_PASSCODE</code> to the environment and redeploy.
        </p>
      ) : (
        <form action="/api/admin/login" method="post" className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Passcode</span>
            <input
              type="password"
              name="passcode"
              required
              autoFocus
              autoComplete="current-password"
              aria-invalid={error || undefined}
              className={`h-12 w-full rounded-xl border px-3 text-base ${error ? "border-black ring-2 ring-black" : "border-neutral-300"}`}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium">
              Wrong passcode. Try again.
            </p>
          )}
          <button type="submit" className="h-12 w-full rounded-full bg-black text-[15px] font-semibold text-white hover:bg-neutral-800">
            Sign in
          </button>
          <p className="pt-2 text-xs text-neutral-500">Demo access control only, not real security.</p>
        </form>
      )}
    </main>
  );
}
