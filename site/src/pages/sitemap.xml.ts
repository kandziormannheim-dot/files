/**
 * Sitemap — alle sechs Inhaltsseiten mit ihren Sprachentsprechungen.
 * Musterseite und Fehlerseite gehören nicht hinein: beide tragen noindex.
 */
import type { APIRoute } from "astro";

const SITE = "https://kandzior.de";

/** [deutscher Pfad, englischer Pfad] */
const paare: ReadonlyArray<readonly [string, string]> = [
  ["/", "/en/"],
  ["/impressum", "/en/imprint"],
  ["/datenschutz", "/en/privacy"],
];

export const GET: APIRoute = () => {
  const eintraege = paare
    .flatMap(([de, en]) => {
      const alternates =
        `    <xhtml:link rel="alternate" hreflang="de" href="${SITE}${de}"/>\n` +
        `    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${en}"/>\n` +
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${de}"/>`;
      return [de, en].map(
        (pfad) => `  <url>\n    <loc>${SITE}${pfad}</loc>\n${alternates}\n  </url>`,
      );
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${eintraege}
</urlset>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
