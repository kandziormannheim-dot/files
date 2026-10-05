import type { ReactNode } from "react";
import { Brand } from "./brand";
import { BottomNav, SideNav } from "./main-nav";
import { UserMenu } from "./user-menu";

type Props = {
  children: ReactNode;
  isAdmin: boolean;
  user: { name: string; email: string };
};

export function AppShell({ children, isAdmin, user }: Props) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14rem_1fr]">
      <header className="flex items-center justify-between gap-2 border-b-4 border-cadenabbia bg-white px-4 py-2 md:hidden">
        <Brand compact />
        <UserMenu {...user} isAdmin={isAdmin} />
      </header>
      <aside className="sticky top-0 hidden h-dvh border-r border-rhoendorf-10 bg-white md:flex md:flex-col">
        <div className="h-1.5 bg-cadenabbia" aria-hidden />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <Brand className="mb-2 px-2" />
          <p className="mb-5 px-2 font-serif text-xs text-rhoendorf-60">
            OV-Management
          </p>
          <SideNav isAdmin={isAdmin} />
          <div className="mt-auto pt-6">
            <UserMenu {...user} isAdmin={isAdmin} />
          </div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl min-w-0 px-4 pt-4 pb-24 md:p-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
