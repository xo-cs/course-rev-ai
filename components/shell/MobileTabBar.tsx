"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconUser } from "@/components/ui/Icons";
import { NAV_ITEMS } from "./navItems";
import { useShell } from "./ShellContext";

export function MobileTabBar() {
  const pathname = usePathname();
  const { openProfile } = useShell();
  const item = "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`${item} ${active ? "text-black" : "text-neutral-400"}`}>
            <Icon strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </Link>
        );
      })}
      <button type="button" onClick={openProfile} className={`${item} text-neutral-400`}>
        <IconUser />
        Profile
      </button>
    </nav>
  );
}
