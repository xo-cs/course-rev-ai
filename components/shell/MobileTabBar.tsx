"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconUser } from "@/components/ui/Icons";
import { NAV_ITEMS } from "./navItems";
import { useShell } from "./ShellContext";

export function MobileTabBar() {
  const pathname = usePathname();
  const { openProfile } = useShell();
  const item = "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 pb-safe pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur md:hidden"
    >
      <div className="flex h-16">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`${item} ${active ? "text-black" : "text-neutral-500"}`}
            >
              <Icon strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </Link>
          );
        })}
        <button type="button" onClick={openProfile} className={`${item} text-neutral-500`}>
          <IconUser />
          Profile
        </button>
      </div>
    </nav>
  );
}
