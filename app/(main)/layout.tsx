import { AppShell } from "@/components/shell/AppShell";
import { programs } from "@/lib/catalog";

/** The three-column app (nav, main, Broddy). /qr and other bare pages live outside this group. */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AppShell programs={programs}>{children}</AppShell>;
}
