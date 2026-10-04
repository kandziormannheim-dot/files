import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav, SideNav } from "./main-nav";
import { UserMenu } from "./user-menu";

type Props = { children: ReactNode; isAdmin: boolean; user: { name: string; email: string } };

export function AppShell({ children, isAdmin, user }: Props) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14rem_1fr]">
      <header className="flex items-center justify-between gap-2 border-b-4 border-akzent px-4 py-2 md:hidden">
        <Link href="/" className="truncate font-bold">
          CDU Seckenheim-Friedrichsfeld
        </Link>
        <UserMenu {...user} isAdmin={isAdmin} />
      </header>
      <aside className="hidden border-r border-neutral-200 p-4 md:flex md:flex-col">
        <Link href="/" className="mb-6 block border-l-4 border-akzent pl-3 font-bold leading-tight">
          CDU Seckenheim-
          <br />
          Friedrichsfeld
        </Link>
        <SideNav isAdmin={isAdmin} />
        <div className="mt-auto pt-6">
          <UserMenu {...user} isAdmin={isAdmin} />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl min-w-0 px-4 pt-4 pb-24 md:p-8">{children}</main>
      <BottomNav />
    </div>
  );
}
