// Deutsche Bezeichnungen für Enums (Oberfläche).
import type { LinkCategory } from "@prisma/client";

export const LINK_CATEGORY_LABELS: Record<LinkCategory, string> = {
  PARTEI: "Partei",
  OV_WEBSEITE: "OV-Webseite",
  SOCIAL_MEDIA: "Social Media",
  VERWALTUNG: "Verwaltung",
  PRESSE: "Presse",
  SONSTIGES: "Sonstiges",
};

export const LINK_CATEGORY_ORDER: LinkCategory[] = [
  "PARTEI",
  "OV_WEBSEITE",
  "SOCIAL_MEDIA",
  "VERWALTUNG",
  "PRESSE",
  "SONSTIGES",
];
