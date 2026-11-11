import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 pt-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Not found</h1>
      <p className="mt-2 text-neutral-600">We couldn&apos;t find that course or page.</p>
      <Link href="/reviews" className="mt-6 inline-block rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white">
        Back to reviews
      </Link>
    </div>
  );
}
