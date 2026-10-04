// Deutsche Bezeichnungen für Enums (Oberfläche).
import type { ActionStatus, ActionType, LinkCategory } from "@prisma/client";

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

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  INFOSTAND: "Infostand",
  PLAKATAKTION: "Plakataktion",
  VERANSTALTUNG: "Veranstaltung",
  BUERGERGESPRAECH: "Bürgergespräch",
  SONSTIGES: "Sonstiges",
};

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  GEPLANT: "geplant",
  BESTAETIGT: "bestätigt",
  DURCHGEFUEHRT: "durchgeführt",
  ABGESAGT: "abgesagt",
};
