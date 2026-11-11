import Link from "next/link";

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center">
        <p className="text-[15px] text-neutral-600">{text}</p>
        <Link href="/reviews" className="mt-4 inline-block text-sm font-medium underline underline-offset-4 hover:no-underline">
          Browse reviews
        </Link>
      </div>
    </div>
  );
}
