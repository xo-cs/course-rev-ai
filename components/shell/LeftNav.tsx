"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconSidebar, IconUser } from "@/components/ui/Icons";
import { profileLabel, profileStore } from "@/lib/profileStore";
import { NAV_ITEMS } from "./navItems";
import { useShell } from "./ShellContext";
import { uiStore } from "./uiStore";

export function LeftNav() {
  const pathname = usePathname();
  const ui = uiStore.useValue();
  const profile = profileStore.useValue();
  const { openProfile } = useShell();
  const collapsed = ui.navCollapsed;

  return (
    <nav
      aria-label="Main"
      className={`hidden shrink-0 flex-col border-r border-neutral-200 bg-white transition-[width] duration-200 md:flex ${
        collapsed ? "w-[68px]" : "w-60"
      }`}
    >
      <div className={`flex h-16 items-center ${collapsed ? "justify-center" : "justify-between pl-5 pr-3"}`}>
        {!collapsed && (
          <Link href="/reviews" className="text-[19px] font-bold tracking-tight">
            CourseRevAI
          </Link>
        )}
        <button
          type="button"
          onClick={() => uiStore.set((s) => ({ ...s, navCollapsed: !s.navCollapsed }))}
          className="flex size-11 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-black"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
        >
          <IconSidebar />
        </button>
      </div>

      <ul className="mt-2 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={`flex h-11 items-center gap-3 rounded-xl text-[15px] font-medium transition-colors ${
                  collapsed ? "justify-center" : "px-3"
                } ${active ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100 hover:text-black"}`}
              >
                <Icon />
                {!collapsed && <span>{label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-3 p-3">
        <button
          type="button"
          onClick={openProfile}
          title={collapsed ? profile.name || profileLabel(profile) : undefined}
          className={`flex w-full items-center gap-3 rounded-xl border border-neutral-200 text-left transition-colors hover:border-black ${
            collapsed ? "justify-center p-2" : "p-2.5"
          }`}
          aria-label={profile.name ? `Signed in as ${profile.name}. Edit profile` : "Demo sign in"}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100">
            <IconUser width={18} height={18} />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{profile.name || "Demo sign in"}</span>
              <span className="block truncate text-xs text-neutral-500">
                {profile.program || profile.year ? profileLabel(profile) : "Name, major and year"}
              </span>
            </span>
          )}
        </button>
        {!collapsed && (
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-[11px] leading-snug text-neutral-500">Course data: Spring 2025 timetable</p>
            <span className="flex shrink-0 gap-2.5">
              <Link href="/qr" className="flex h-8 items-center text-[11px] font-medium text-neutral-500 underline underline-offset-2 hover:text-black">
                Share
              </Link>
              <Link href="/admin" className="flex h-8 items-center text-[11px] font-medium text-neutral-500 underline underline-offset-2 hover:text-black">
                Admin
              </Link>
            </span>
          </div>
        )}
      </div>
    </nav>
  );
}
