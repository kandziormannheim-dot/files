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
  { key: "protokoll.geschaeftsstelle", file: "protokoll-geschaeftsstelle.mail.hbs", kind: "mail", name: "Übersendung an die Kreisgeschäftsstelle", usage: "nach Genehmigung (LV-Satzung § 51 Abs. 3)" },
  { key: "umlauf.einleitung", file: "umlauf-einleitung.mail.hbs", kind: "mail", name: "Einleitung Umlaufverfahren", usage: "Umlaufbeschluss gestartet" },
  { key: "umlauf.ergebnis", file: "umlauf-ergebnis.mail.hbs", kind: "mail", name: "Ergebnis Umlaufverfahren", usage: "Ergebnis festgestellt" },
  { key: "erinnerung.zusage", file: "erinnerung-zusage.mail.hbs", kind: "mail", name: "Erinnerung Zu-/Absage", usage: "an alle ohne Rückmeldung" },
  { key: "sitzung.absage", file: "absage-sitzung.mail.hbs", kind: "mail", name: "Absage einer Sitzung", usage: "Sitzung abgesagt" },
  { key: "aufgabe.erinnerung", file: "aufgaben-erinnerung.mail.hbs", kind: "mail", name: "Aufgaben-Erinnerung", usage: "Frist naht / überschritten" },
  { key: "aktion.helferaufruf", file: "helferaufruf.mail.hbs", kind: "mail", name: "Helferaufruf", usage: "Aktion veröffentlicht" },
  { key: "prompt.protokoll", file: "prompt-protokollentwurf.md", kind: "prompt", name: "Prompt Protokollentwurf", usage: "Claude-Entwurf aus Transkript" },
  { key: "aufgabe.zugewiesen", file: "aufgabe-zugewiesen.mail.hbs", kind: "mail", name: "Neue Aufgabe zugewiesen", usage: "Aufgabe zugewiesen" },
  { key: "antrag.einberufung", file: "antrag-einberufung.mail.hbs", kind: "mail", name: "Antrag auf Einberufung", usage: "an Admins, sobald fünf Mitglieder einen Antrag tragen" },
  { key: "ladungsfrist.hinweis", file: "ladungsfrist-hinweis.mail.hbs", kind: "mail", name: "Hinweis Ladungsfrist", usage: "an Admins, wenn die Einladung bald raus muss" },
  { key: "umlauf.frist", file: "umlauf-frist.mail.hbs", kind: "mail", name: "Umlaufverfahren: Frist abgelaufen", usage: "an Admins nach Fristablauf" },
  { key: "transkript.fertig", file: "transkript-fertig.mail.hbs", kind: "mail", name: "Protokollentwurf bereit", usage: "an die Person, die das Transkript hochgeladen hat" },
  { key: "anmeldung.mail", file: "anmeldung.mail.hbs", kind: "mail", name: "Anmeldelink", usage: "Login per Magic Link" },
  { key: "zugang.einladung", file: "zugang-einladung.mail.hbs", kind: "mail", name: "Zugang eingerichtet", usage: "Nutzer angelegt" },
];

export function templateDef(key: string): TemplateDef {
  const def = TEMPLATE_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`Unbekannte Vorlage: ${key}`);
  return def;
}
