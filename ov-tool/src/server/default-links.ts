import type { LinkCategory, PrismaClient } from "@prisma/client";

/**
 * Standard-Links für den Link-Hub. Werden beim Start einmal je Version ergänzt (nur fehlende Adressen),
 * damit gelöschte Links nicht bei jedem Neustart zurückkommen. Keine Zugangsdaten – Anmeldung immer selbst.
 */
export const DEFAULT_LINKS_VERSION = "1";

type DefaultLink = { title: string; url: string; category: LinkCategory; description?: string; accessNote?: string };

export const DEFAULT_LINKS: DefaultLink[] = [
  // Partei / CDU-Dienste
  { title: "CDUplus", url: "https://www.cduplus.cdu.de", category: "PARTEI", description: "Mitgliedernetz der CDU", accessNote: "Anmeldung mit eigenem CDUplus-Konto (SSO)" },
  { title: "CDUplus – Seite 1", url: "https://www.cduplus.cdu.de/page/aff408fb-0389-475b-8ecd-f70f712548b1", category: "PARTEI", accessNote: "Anmeldung mit eigenem CDUplus-Konto" },
  { title: "CDUplus – Seite 2", url: "https://www.cduplus.cdu.de/page/ba1bb930-cdfd-4779-8102-cba78289aa0d", category: "PARTEI", accessNote: "Anmeldung mit eigenem CDUplus-Konto" },
  { title: "CDU Social Hub", url: "https://www.social-hub.cdu.de/", category: "SOCIAL_MEDIA", description: "Vorlagen und Inhalte für Social Media", accessNote: "Anmeldung mit eigenem CDU-Konto" },
  { title: "CDU Bilderdatenbank", url: "https://www.bilder.cdu.de/ubg/webgate/access", category: "PARTEI", description: "Bilder und Logos der CDU", accessNote: "Anmeldung mit eigenem CDU-Konto" },
  { title: "CDU Shop", url: "https://www.shop.cdu.de/sso/login", category: "PARTEI", description: "Werbemittel bestellen", accessNote: "Anmeldung per CDU-SSO" },
  { title: "CDU Kreativ", url: "https://www.cdu-kreativ.de/", category: "PARTEI", description: "Gestaltungsportal für Plakate, Flyer, Social-Media-Grafiken" },
  { title: "CDU Kreisverband Mannheim", url: "https://www.cdumannheim.de/", category: "PARTEI" },
  { title: "CDU Baden-Württemberg", url: "https://www.cdu-bw.de/", category: "PARTEI" },
  // Eigene Webseiten inkl. Bearbeitung
  { title: "Website OV", url: "https://cdu-sf.de", category: "OV_WEBSEITE" },
  { title: "Website OV bearbeiten (WordPress)", url: "https://cdu-sf.de/wp-admin/", category: "OV_WEBSEITE", accessNote: "eigenes WordPress-Konto" },
  { title: "Website Bezirksbeirat", url: "https://bbr.cdu-sf.de", category: "OV_WEBSEITE" },
  { title: "Website Bezirksbeirat bearbeiten (WordPress)", url: "https://bbr.cdu-sf.de/wp-admin/", category: "OV_WEBSEITE", accessNote: "eigenes WordPress-Konto" },
  // Social Media / Newsletter
  { title: "Facebook OV", url: "https://www.facebook.com/CDUSeckenheimFriedrichsfeld", category: "SOCIAL_MEDIA" },
  { title: "Meta Business Suite (Beiträge planen)", url: "https://business.facebook.com/latest/content_calendar", category: "SOCIAL_MEDIA", description: "Facebook/Instagram-Beiträge planen und veröffentlichen", accessNote: "Seitenrolle bei Facebook nötig" },
  { title: "Instagram (KV Mannheim)", url: "https://www.instagram.com/cdumannheim/", category: "SOCIAL_MEDIA" },
  { title: "Brevo (Newsletter)", url: "https://app.brevo.com/", category: "SOCIAL_MEDIA", description: "Newsletter-Versand", accessNote: "eigenes Brevo-Konto" },
  // Verwaltung / Presse
  { title: "Bürgerinfo Stadt Mannheim (öffentlich)", url: "https://buergerinfo.mannheim.de/buergerinfo/", category: "VERWALTUNG", description: "Sitzungen, Tagesordnungen, Vorlagen" },
  { title: "Bürgerinfo Mandatsträgerbereich", url: "https://buergerinfo.mannheim.de/rima/ri/ylogon.asp", category: "VERWALTUNG", accessNote: "nur BBR-Mitglieder mit eigenem Login" },
  { title: "Presseakkreditierung (Website)", url: "https://cdu-sf.de/anmeldung-presseakkreditierung/", category: "PRESSE" },
];

const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();

export async function seedDefaultLinks(db: PrismaClient): Promise<number> {
  const marker = await db.setting.findUnique({ where: { key: "links.defaultsVersion" } });
  if (marker?.value === DEFAULT_LINKS_VERSION) return 0;
  const existing = new Set((await db.link.findMany({ select: { url: true } })).map((l) => norm(l.url)));
  const maxPos = new Map<string, number>();
  for (const g of await db.link.groupBy({ by: ["category"], _max: { position: true } })) maxPos.set(g.category, g._max.position ?? 0);
  let added = 0;
  for (const l of DEFAULT_LINKS) {
    if (existing.has(norm(l.url))) continue;
    const pos = (maxPos.get(l.category) ?? 0) + 1;
    maxPos.set(l.category, pos);
    await db.link.create({ data: { title: l.title, url: l.url, category: l.category, description: l.description ?? "", accessNote: l.accessNote ?? "", position: pos } });
    added++;
  }
  await db.setting.upsert({ where: { key: "links.defaultsVersion" }, update: { value: DEFAULT_LINKS_VERSION }, create: { key: "links.defaultsVersion", value: DEFAULT_LINKS_VERSION } });
  return added;
}
