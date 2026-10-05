import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { requirePageCapability } from "@/server/auth/session";
import { mailFrom, mailReplyTo, mailRoute } from "@/server/mail/transport";
import { getRawSettings } from "@/server/services/settings";
import { listActiveUsers } from "@/server/services/users";
import { resetBriefbogenAction, sendTestMailAction, updateSettingsAction, uploadBriefbogenAction } from "../actions";

export const metadata: Metadata = { title: "Allgemeine Einstellungen" };

export default async function GeneralSettingsPage() {
  const user = await requirePageCapability("settings.manage");
  const [s, users] = await Promise.all([getRawSettings(user), listActiveUsers()]);
  const route = mailRoute();
  const num = (name: keyof typeof s, label: string, hint?: string, min = 0) => (
    <Field label={label} name={name} hint={hint}>
      <Input id={name} name={name} type="number" min={min} defaultValue={s[name]} required />
    </Field>
  );
  const text = (name: keyof typeof s, label: string, hint?: string) => (
    <Field label={label} name={name} hint={hint}>
      <Input id={name} name={name} defaultValue={s[name]} />
    </Field>
  );
  const personSelect = (name: "ov.chairUserId" | "ov.deputyUserId", label: string, hint: string) => (
    <Field label={label} name={name} hint={hint}>
      <NativeSelect id={name} name={name} defaultValue={s[name]}>
        <option value="">–</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
            {u.functionTitle ? ` (${u.functionTitle})` : ""}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <>
      <PageHeader title="Allgemeine Einstellungen" />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Mailversand</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            Absender: <strong>{mailFrom()}</strong>
            {mailReplyTo() ? <> · Antworten an <strong>{mailReplyTo()}</strong></> : null}
            <br />
            <span className="text-rhoendorf-60">
              {route.via === "brevo"
                ? "Versand über Brevo (smtp-relay.brevo.com) – Domain cdu-sf.de ist bei Brevo authentifiziert."
                : route.via === "smtp"
                  ? `Versand über ${route.host}`
                  : "Kein Mailserver – Mails landen nur im Log."}
            </span>
          </p>
          <ActionForm action={sendTestMailAction}>
            <SubmitButton variant="outline" size="sm" pendingText="Wird gesendet …">
              Testmail an mich senden
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
      <ActionForm action={updateSettingsAction} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ortsverband</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {text("ov.name", "Kurzname", "Platzhalter {{ov.name}}")}
            {text("ov.ort", "Ort", "z. B. für „Mannheim, 05.11.2026“")}
            {text("ov.nameLang", "Langer Name", "„… der CDU Mannheim-Süd / Seckenheim-Friedrichsfeld“")}
            {text("ov.nameAnschrift", "Name in der Anschrift", "„An die Vorstandsmitglieder und Gäste des …“")}
            {personSelect("ov.chairUserId", "Vorsitzende/r", "Absender der Einladungen (mit Unterschriftsbild), erster Unterzeichner")}
            {personSelect("ov.deputyUserId", "Stellvertretung", "zweiter Unterzeichner des Protokolls")}
            {text("meeting.defaultLocation", "Üblicher Sitzungsort", "Vorbelegung beim Anlegen einer Sitzung")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sitzungen und Fristen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {num("meeting.noticeDays", "Ladungsfrist (Tage)", "Mindestens 7 Tage bei E-Mail (LV-Satzung § 50 Abs. 3)", 7)}
            {num("meeting.responseDaysBefore", "Rückmeldefrist (Tage vor der Sitzung)")}
            {num("meeting.rsvpReminderDaysBefore", "Erinnerung Zu-/Absage (Tage vor der Sitzung)", "an alle ohne Rückmeldung")}
            {num("meeting.invitationWarnDays", "Hinweis an Admin (Tage vor Ablauf der Ladungsfrist)")}
            <Field
              label="Beschlussfähigkeit"
              name="meeting.quorumRule"
              hint="Standard ist die strengere Regel des Bundesstatuts. Umstellen nur, wenn der Kreisverband es anders auslegt."
            >
              <NativeSelect id="meeting.quorumRule" name="meeting.quorumRule" defaultValue={s["meeting.quorumRule"]}>
                <option value="MEHR_ALS_HAELFTE">mehr als die Hälfte (Statut § 40 Abs. 1)</option>
                <option value="MINDESTENS_HAELFTE">mindestens die Hälfte (LV-Satzung § 52 Abs. 1)</option>
              </NativeSelect>
            </Field>
            {num("circulation.defaultDays", "Frist Umlaufverfahren (Tage)", undefined, 1)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Wahlen und öffentliche Seiten</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Letzte Vorstandswahl" name="election.lastDate" hint="Nur nötig, solange keine Wahl im Tool abgeschlossen ist (Wahlperiode LV-Satzung § 56 Abs. 1).">
              <Input id="election.lastDate" name="election.lastDate" type="date" defaultValue={s["election.lastDate"]} />
            </Field>
            <div />
            {text("public.imprintUrl", "Impressum (Link)", "auf Landing Pages und im Presseportal")}
            {text("public.privacyUrl", "Datenschutzerklärung (Link)", "auf Landing Pages und im Presseportal")}
            <Field label="Pressekontakt (öffentlich)" name="press.contact" hint="erscheint im Presseportal und unter jeder Pressemitteilung" className="sm:col-span-2">
              <Textarea id="press.contact" name="press.contact" defaultValue={s["press.contact"]} rows={3} placeholder={"Martin Kandzior, Vorsitzender\npresse@cdu-sf.de · 0621 …"} />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Erinnerungen, Geschäftsstelle, Löschfristen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {num("task.reminderDaysBefore", "Aufgaben-Erinnerung (Tage vor Frist)")}
            <div className="flex items-end pb-2">
              <input type="hidden" name="task.overdueReminder__present" value="1" />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="task.overdueReminder" defaultChecked={s["task.overdueReminder"] === "true"} />
                Erinnerung bei Überfälligkeit
              </label>
            </div>
            <Field
              label="E-Mail der Kreisgeschäftsstelle"
              name="office.email"
              hint="Genehmigte Protokolle werden dorthin übersandt (LV-Satzung § 51 Abs. 3)."
            >
              <Input id="office.email" name="office.email" type="email" defaultValue={s["office.email"]} />
            </Field>
            <div className="flex items-end pb-2">
              <input type="hidden" name="office.autoSend__present" value="1" />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="office.autoSend" defaultChecked={s["office.autoSend"] === "true"} />
                nach Genehmigung automatisch übersenden
              </label>
            </div>
            {num("retention.transcriptDays", "Transkripte spätestens löschen nach (Tagen)", "sonst mit Genehmigung des Protokolls", 1)}
            {num("retention.citizenContactMonths", "Bürgerkontaktdaten löschen (Monate nach Erledigung)", undefined, 1)}
            <Field label="Kategorien für Stadtteil-Themen" name="topic.categories" hint="eine je Zeile" className="sm:col-span-2">
              <Textarea id="topic.categories" name="topic.categories" defaultValue={s["topic.categories"]} rows={6} />
            </Field>
          </CardContent>
        </Card>
        <SubmitButton className="self-start">Einstellungen speichern</SubmitButton>
      </ActionForm>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Briefbogen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-neutral-600">
            Ganzseitiges Hintergrundbild (A4, PNG, z. B. 1414×2000 px) für alle PDFs. Aktuell:{" "}
            {s["briefbogen.path"] ? "eigener Briefbogen" : "Standard aus templates/assets/briefbogen.png"}.
          </p>
          <ActionForm action={uploadBriefbogenAction} className="flex flex-wrap items-center gap-2">
            <Input type="file" name="briefbogen" accept="image/png" required className="max-w-sm" aria-label="PNG-Datei" />
            <SubmitButton variant="outline" pendingText="Wird hochgeladen …">
              Briefbogen ersetzen
            </SubmitButton>
          </ActionForm>
          {s["briefbogen.path"] ? (
            <ActionForm action={resetBriefbogenAction}>
              <SubmitButton variant="ghost" size="sm">
                Standard wiederherstellen
              </SubmitButton>
            </ActionForm>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
