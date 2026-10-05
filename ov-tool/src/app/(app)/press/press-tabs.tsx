import Link from "next/link";
import { cn } from "@/lib/utils";

export function PressTabs({ active, showContacts }: { active: "pm" | "contacts" | "clippings"; showContacts: boolean }) {
  const tabs = [
    { key: "pm", href: "/press", label: "Pressemitteilungen" },
    ...(showContacts ? [{ key: "contacts", href: "/press/contacts", label: "Presseverteiler" }] : []),
    { key: "clippings", href: "/press/clippings", label: "Pressespiegel" },
  ];
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b" aria-label="Presse">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn("-mb-px border-b-2 px-3 py-2 text-sm", active === t.key ? "border-cadenabbia font-bold text-rhoendorf" : "border-transparent text-rhoendorf/70 hover:text-rhoendorf")}
        >
          {t.label}
        </Link>
      ))}
      <a href="/presse" target="_blank" rel="noreferrer" className="ml-auto px-3 py-2 text-sm text-rhoendorf underline">
        Öffentliches Portal ↗
      </a>
    </nav>
  );
}
