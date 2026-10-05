import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, ExternalLink, MapPin } from "lucide-react";
import { RichText } from "@/components/rich-text";
import { formatDateLong, formatTimeShort } from "@/lib/dates";
import { countView, getPublicPage, landingLinks } from "@/server/services/landing";
import { getSettings } from "@/server/services/settings";
import { submitLandingAction } from "./actions";
import { LandingForm } from "./landing-form";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = await getPublicPage((await params).slug);
  return page ? { title: page.title, description: page.subtitle || undefined } : { title: "Seite nicht gefunden" };
}

export default async function LandingPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublicPage(slug);
  if (!page) notFound();
  await countView(page.id);
  const settings = await getSettings();
  const links = landingLinks(page);
  return (
    <article className="flex flex-col gap-6">
      <header className="rounded-lg bg-cadenabbia px-6 py-8 text-white">
        <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.01em] sm:text-4xl">{page.title}</h1>
        {page.subtitle ? <p className="mt-2 font-serif text-lg">{page.subtitle}</p> : null}
        {page.eventAt || page.eventLocation ? (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-base font-semibold">
            {page.eventAt ? (
              <span className="flex items-center gap-2">
                <CalendarDays className="size-5" /> {formatDateLong(page.eventAt)}, {formatTimeShort(page.eventAt)} Uhr
              </span>
            ) : null}
            {page.eventLocation ? (
              <span className="flex items-center gap-2">
                <MapPin className="size-5" /> {page.eventLocation}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>
      {page.body ? <RichText text={page.body} className="text-[17px] text-union-schwarz" /> : null}
      {links.length ? (
        <ul className="flex flex-col gap-3">
          {links.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-lg border-2 border-rhoendorf px-5 py-4 text-base font-bold text-rhoendorf hover:bg-cadenabbia-10"
              >
                {l.label} <ExternalLink className="size-4 shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {page.formEnabled ? (
        <section className="rounded-lg border border-rhoendorf-10 bg-cadenabbia-10 p-5">
          <LandingForm
            action={submitLandingAction.bind(null, page.slug)}
            title={page.formTitle}
            askPhone={page.askPhone}
            askMessage={page.askMessage}
            messageLabel={page.messageLabel}
            consentText={page.consentText}
            newsletterOption={page.newsletterOption}
            privacyUrl={settings.publicSite.privacyUrl}
          />
        </section>
      ) : null}
    </article>
  );
}
