// Alle Standardvorlagen mit Schlüssel, Datei und Art (templates/README.md, Tabelle „Dateien“).
export type TemplateKind = "mail" | "dokument" | "json" | "prompt";

export type TemplateDef = { key: string; file: string; kind: TemplateKind; name: string; usage: string };

export const TEMPLATE_DEFS: TemplateDef[] = [
  { key: "einladung.dokument", file: "einladung-vorstandssitzung.dokument.hbs", kind: "dokument", name: "Einladung Vorstandssitzung (PDF)", usage: "PDF-Anhang der Einladung" },
  { key: "einladung.mail", file: "einladung-vorstandssitzung.mail.hbs", kind: "mail", name: "Einladung Vorstandssitzung (E-Mail)", usage: "Einladung versenden" },
  { key: "einladung.wiederholung", file: "einladung-wiederholung.mail.hbs", kind: "mail", name: "Einladung nach Beschlussunfähigkeit", usage: "Sitzung wegen Beschlussunfähigkeit aufgehoben" },
  { key: "tagesordnung.standard", file: "standard-tagesordnung.json", kind: "json", name: "Standard-Tagesordnung", usage: "Vorbelegung neuer Sitzungen" },
  { key: "protokoll.dokument", file: "protokoll.dokument.hbs", kind: "dokument", name: "Protokoll (PDF)", usage: "Protokoll als PDF und DOCX" },
  { key: "protokoll.versand", file: "protokoll-versand.mail.hbs", kind: "mail", name: "Protokollversand", usage: "Protokoll versendet" },
  { key: "umlauf.einleitung", file: "umlauf-einleitung.mail.hbs", kind: "mail", name: "Einleitung Umlaufverfahren", usage: "Umlaufbeschluss gestartet" },
  { key: "umlauf.ergebnis", file: "umlauf-ergebnis.mail.hbs", kind: "mail", name: "Ergebnis Umlaufverfahren", usage: "Ergebnis festgestellt" },
  { key: "erinnerung.zusage", file: "erinnerung-zusage.mail.hbs", kind: "mail", name: "Erinnerung Zu-/Absage", usage: "an alle ohne Rückmeldung" },
  { key: "sitzung.absage", file: "absage-sitzung.mail.hbs", kind: "mail", name: "Absage einer Sitzung", usage: "Sitzung abgesagt" },
  { key: "aufgabe.erinnerung", file: "aufgaben-erinnerung.mail.hbs", kind: "mail", name: "Aufgaben-Erinnerung", usage: "Frist naht / überschritten" },
  { key: "aktion.helferaufruf", file: "helferaufruf.mail.hbs", kind: "mail", name: "Helferaufruf", usage: "Aktion veröffentlicht" },
  { key: "prompt.protokoll", file: "prompt-protokollentwurf.md", kind: "prompt", name: "Prompt Protokollentwurf", usage: "Claude-Entwurf aus Transkript" },
  { key: "aufgabe.zugewiesen", file: "aufgabe-zugewiesen.mail.hbs", kind: "mail", name: "Neue Aufgabe zugewiesen", usage: "Aufgabe zugewiesen" },
  { key: "anmeldung.mail", file: "anmeldung.mail.hbs", kind: "mail", name: "Anmeldelink", usage: "Login per Magic Link" },
  { key: "zugang.einladung", file: "zugang-einladung.mail.hbs", kind: "mail", name: "Zugang eingerichtet", usage: "Nutzer angelegt" },
];

export function templateDef(key: string): TemplateDef {
  const def = TEMPLATE_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`Unbekannte Vorlage: ${key}`);
  return def;
}
