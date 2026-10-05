import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichText } from "@/components/rich-text";
import { formatDateLong } from "@/lib/dates";
import { publicRelease } from "@/server/services/press";
import { getSettings } from "@/server/services/settings";
import { PrintLink } from "./print-link";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const pm = await publicRelease((await params).slug);
  return pm ? { title: pm.title, description: pm.subtitle || undefined } : { title: "Nicht gefunden" };
}

export default async function PressReleasePage({ params }: { params: Promise<{ slug: string }> }) {
  const pm = await publicRelease((await params).slug);
  if (!pm) notFound();
  const settings = await getSettings();
  return (
    <article className="flex flex-col gap-4">
      <style>{`@media print { header, footer, .no-print { display: none !important; } main { padding: 0 !important; } }`}</style>
      <Link href="/presse" className="no-print text-sm text-rhoendorf underline">
        ← Alle Pressemitteilungen
      </Link>
      <div className="text-sm font-semibold uppercase tracking-[0.08em] text-cadenabbia">Pressemitteilung · {formatDateLong(pm.publishedAt)}</div>
      <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.01em] text-rhoendorf">{pm.title}</h1>
      {pm.subtitle ? <p className="font-serif text-xl text-rhoendorf">{pm.subtitle}</p> : null}
      <RichText text={pm.body} className="text-[17px]" />
      {settings.publicSite.pressContact ? (
        <div className="mt-4 border-t pt-4 text-sm">
          <div className="font-bold text-rhoendorf">Pressekontakt</div>
          <p className="whitespace-pre-line">{settings.publicSite.pressContact}</p>
        </div>
      ) : null}
      <PrintLink />
    </article>
  );
}
