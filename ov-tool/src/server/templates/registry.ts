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
  { key: "prompt.marketing", file: "prompt-marketing.md", kind: "prompt", name: "Prompt Social Media & Blog", usage: "Claude-Entwurf für Marketing-Beiträge" },
  { key: "prompt.bbr-social", file: "prompt-bbr-social.md", kind: "prompt", name: "Prompt BBR-Anliegen → Social Media", usage: "Claude-Entwürfe für BBR- und OV-Kanal aus der Kurzfassung eines BBR-Anliegens" },
  { key: "prompt.video", file: "prompt-video.md", kind: "prompt", name: "Prompt Videoschnitt (Regievorgaben)", usage: "Claude-Schnittplan für Aufklärungsvideos aus hochgeladenen Clips" },
  { key: "prompt.protokoll", file: "prompt-protokollentwurf.md", kind: "prompt", name: "Prompt Protokollentwurf", usage: "Claude-Entwurf aus Transkript" },
  { key: "aufgabe.zugewiesen", file: "aufgabe-zugewiesen.mail.hbs", kind: "mail", name: "Neue Aufgabe zugewiesen", usage: "Aufgabe zugewiesen" },
  { key: "antrag.einberufung", file: "antrag-einberufung.mail.hbs", kind: "mail", name: "Antrag auf Einberufung", usage: "an Admins, sobald fünf Mitglieder einen Antrag tragen" },
  { key: "ladungsfrist.hinweis", file: "ladungsfrist-hinweis.mail.hbs", kind: "mail", name: "Hinweis Ladungsfrist", usage: "an Admins, wenn die Einladung bald raus muss" },
  { key: "umlauf.frist", file: "umlauf-frist.mail.hbs", kind: "mail", name: "Umlaufverfahren: Frist abgelaufen", usage: "an Admins nach Fristablauf" },
  { key: "transkript.fertig", file: "transkript-fertig.mail.hbs", kind: "mail", name: "Protokollentwurf bereit", usage: "an die Person, die das Transkript hochgeladen hat" },
  { key: "anmeldung.mail", file: "anmeldung.mail.hbs", kind: "mail", name: "Anmeldelink", usage: "Login per Magic Link" },
  { key: "zugang.einladung", file: "zugang-einladung.mail.hbs", kind: "mail", name: "Zugang eingerichtet", usage: "Nutzer angelegt" },
  { key: "email.bestaetigung", file: "email-bestaetigung.mail.hbs", kind: "mail", name: "Neue E-Mail-Adresse bestätigen", usage: "an die neue Adresse, wenn jemand seine E-Mail-Adresse ändert" },
  { key: "beschluss.dokument", file: "beschluss.dokument.hbs", kind: "dokument", name: "Beschluss (PDF)", usage: "Beschlussauszug im Briefbogen" },
  { key: "antrag.dokument", file: "antrag.dokument.hbs", kind: "dokument", name: "Antrag an den Kreisverband (PDF)", usage: "Antrag aus einem Beschluss" },
  { key: "antrag.versand", file: "antrag-versand.mail.hbs", kind: "mail", name: "Antrag einreichen (E-Mail)", usage: "Begleit-Mail an die Kreisgeschäftsstelle mit Antrag und Beschluss als PDF" },
  { key: "auslagen.dokument", file: "auslagen.dokument.hbs", kind: "dokument", name: "Auslagenerstattung (PDF)", usage: "Antrag mit Positionen, Erstattungsart und Belegen" },
  { key: "auslagen.versand", file: "auslagen-versand.mail.hbs", kind: "mail", name: "Auslagenerstattung an die Kreisgeschäftsstelle", usage: "Versand des freigegebenen Antrags" },
  { key: "inventar.liste", file: "inventar-liste.dokument.hbs", kind: "dokument", name: "Inventarliste (PDF)", usage: "Liste der Gegenstände im Inventar, wahlweise als Inventurliste mit Prüfspalte" },
  { key: "inventar.leihprotokoll", file: "inventar-leihprotokoll.dokument.hbs", kind: "dokument", name: "Leihprotokoll Inventar (PDF)", usage: "Protokoll bei Ausgabe und Rückgabe eines Gegenstands, mit Fotos" },
  { key: "inventar.ausgabe", file: "inventar-ausgabe.mail.hbs", kind: "mail", name: "Leihprotokoll Ausgabe (E-Mail)", usage: "an alle Beteiligten nach dem Buchen des Verleihs, mit Protokoll als PDF" },
  { key: "inventar.rueckgabe", file: "inventar-rueckgabe.mail.hbs", kind: "mail", name: "Leihprotokoll Rückgabe (E-Mail)", usage: "an alle Beteiligten nach dem Buchen der Rückgabe, mit Protokoll als PDF" },
  { key: "landing.bestaetigung", file: "landing-bestaetigung.mail.hbs", kind: "mail", name: "Landing Page: Newsletter bestätigen", usage: "Double-Opt-in, wenn auf einer Landing Page der Newsletter angekreuzt wurde" },
  { key: "presse.bestaetigung", file: "presse-bestaetigung.mail.hbs", kind: "mail", name: "Presseverteiler: Registrierung bestätigen", usage: "Double-Opt-in für Pressevertreter" },
  { key: "presse.mitteilung", file: "presse-mitteilung.mail.hbs", kind: "mail", name: "Pressemitteilung (Versand)", usage: "Einzelversand an den Presseverteiler" },
  { key: "email.geaendert", file: "email-geaendert.mail.hbs", kind: "mail", name: "E-Mail-Adresse geändert", usage: "Hinweis an die alte Adresse nach der Änderung" },
];

export function templateDef(key: string): TemplateDef {
  const def = TEMPLATE_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`Unbekannte Vorlage: ${key}`);
  return def;
}
