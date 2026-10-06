import type { MarketingStatus } from "@prisma/client";

export const MARKETING_STATUS: Record<MarketingStatus, { label: string; variant: "secondary" | "warning" | "success" }> = {
  ENTWURF: { label: "Entwurf", variant: "secondary" },
  FREIGEGEBEN: { label: "Freigegeben", variant: "warning" },
  VEROEFFENTLICHT: { label: "Veröffentlicht", variant: "success" },
};

type FormatInfo = { kind: string; account: string | null; site: string | null };

/** Für wen der Beitrag gedacht ist: BBR-Gruppe oder CDU-Ortsverband (Blog nach Webseite, Social nach Kanal). */
export function audienceOf(p: FormatInfo): "BBR" | "CDU" | null {
  if (p.kind === "BLOG") return p.site === "BBR" ? "BBR" : "CDU";
  return p.account === "BBR" ? "BBR" : p.account === "OV" ? "CDU" : null;
}

export const AUDIENCE_LABEL = { BBR: "BBR", CDU: "CDU-Ortsverband" } as const;

/** z. B. „Blog · BBR“, „Social · CDU-Ortsverband“ */
export function formatLabel(p: FormatInfo): string {
  const a = audienceOf(p);
  return `${p.kind === "BLOG" ? "Blog" : "Social"}${a ? ` · ${AUDIENCE_LABEL[a]}` : ""}`;
}

/** Reihenfolge: Blog vor Social, jeweils BBR vor CDU-Ortsverband, allgemeine zuletzt. */
export function formatRank(p: FormatInfo): number {
  const a = audienceOf(p);
  return (p.kind === "BLOG" ? 0 : 3) + (a === "BBR" ? 0 : a === "CDU" ? 1 : 2);
}

export function sortFormats<T extends FormatInfo>(posts: T[]): T[] {
  return [...posts].sort((a, b) => formatRank(a) - formatRank(b));
}
