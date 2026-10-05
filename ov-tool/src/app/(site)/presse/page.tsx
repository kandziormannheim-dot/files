import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { publicReleases } from "@/server/services/press";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Presse" };
export const dynamic = "force-dynamic";

export default async function PressPortal({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [releases, settings] = await Promise.all([publicReleases(q), getSettings()]);
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-[-0.01em] text-rhoendorf">Presse</h1>
        <p className="mt-1 font-serif text-lg text-rhoendorf">Pressemitteilungen der CDU {settings.ov.name}</p>
      </header>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-4">
          <form className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
            <Input name="q" type="search" defaultValue={q} placeholder="Pressemitteilungen durchsuchen" className="pl-9" aria-label="Suchen" />
          </form>
          {releases.length === 0 ? <p className="text-neutral-600">{q ? "Keine Treffer." : "Noch keine Pressemitteilungen."}</p> : null}
          <ul className="flex flex-col divide-y">
            {releases.map((r) => (
              <li key={r.id} className="py-4">
                <div className="text-sm text-neutral-600">{formatDate(r.publishedAt)}</div>
                <Link href={`/presse/${r.slug}`} className="text-lg font-extrabold text-rhoendorf hover:underline">
                  {r.title}
                </Link>
                {r.subtitle ? <p className="font-serif text-neutral-700">{r.subtitle}</p> : null}
              </li>
            ))}
          </ul>
        </section>
        <aside className="flex flex-col gap-4">
          <div className="rounded-lg bg-cadenabbia-10 p-4">
            <h2 className="font-extrabold text-rhoendorf">Für Journalistinnen und Journalisten</h2>
            <p className="mt-1 text-sm">Erhalten Sie unsere Pressemitteilungen direkt per E-Mail.</p>
            <Link href="/presse/registrierung" className="mt-3 inline-block rounded-md bg-rhoendorf px-4 py-2 text-sm font-semibold text-white hover:bg-rhoendorf/90">
              In den Presseverteiler eintragen
            </Link>
          </div>
          {settings.publicSite.pressContact ? (
            <div className="rounded-lg border p-4">
              <h2 className="font-extrabold text-rhoendorf">Pressekontakt</h2>
              <p className="mt-1 whitespace-pre-line text-sm">{settings.publicSite.pressContact}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
