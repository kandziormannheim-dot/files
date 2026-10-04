import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav, SideNav } from "./main-nav";

type Props = { children: ReactNode; isAdmin: boolean };

export function AppShell({ children, isAdmin }: Props) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14rem_1fr]">
      <header className="flex items-center gap-2 border-b-4 border-akzent px-4 py-3 md:hidden">
        <Link href="/" className="font-bold">
          CDU Seckenheim-Friedrichsfeld
        </Link>
      </header>
      <aside className="hidden border-r border-neutral-200 p-4 md:block">
        <Link href="/" className="mb-6 block border-l-4 border-akzent pl-3 font-bold leading-tight">
          CDU Seckenheim-
          <br />
          Friedrichsfeld
        </Link>
        <SideNav isAdmin={isAdmin} />
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-24 md:p-8">{children}</main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  );
}
