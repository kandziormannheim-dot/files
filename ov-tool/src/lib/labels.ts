// Deutsche Bezeichnungen für Enums (Oberfläche).
import type { ActionStatus, ActionType, District, LinkCategory, TopicEventType, TopicStatus } from "@prisma/client";

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

export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  NEU: "neu",
  IN_BEARBEITUNG: "in Bearbeitung",
  BEI_STADTRAETEN: "bei den Stadträten",
  IM_BEZIRKSBEIRAT: "im Bezirksbeirat",
  PRESSE: "Presse",
  ERLEDIGT: "erledigt",
  ZURUECKGESTELLT: "zurückgestellt",
};

export const DISTRICT_LABELS: Record<District, string> = {
  SECKENHEIM: "Seckenheim",
  FRIEDRICHSFELD: "Friedrichsfeld",
  BEIDE: "beide",
};

export const TOPIC_EVENT_LABELS: Record<TopicEventType, string> = {
  NOTIZ: "Notiz",
  STATUS: "Status",
  ANFRAGE: "Anfrage",
  ANTWORT_VERWALTUNG: "Antwort der Verwaltung",
  PRESSE: "Presseartikel",
  SITZUNG: "Sitzung",
  SONSTIGES: "Sonstiges",
};
